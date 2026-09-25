//! File flows and window lifecycle: dialogs, open/save/save-as, the dirty and
//! conflict prompts, drag-drop, quit, startup restore and debounced persist.
//! Port of the corresponding parts of `src/app.ts` and `src/fs.ts` — except
//! there is no IPC now: notes-core is called directly with `App::granted`.
//!
//! TODO(unit 11): everything marked below. The scaffold versions work for the
//! happy path so other units have something to click through.

use crate::app::{App, Message as AppMessage};
use crate::editor::{self, Buffer};
use crate::overlay::{Choice, Modal, ToastKind};
use iced::{window, Point, Size, Subscription, Task};
use std::path::PathBuf;
use std::time::{Duration, Instant};

pub const PERSIST_DEBOUNCE: Duration = Duration::from_millis(300);

/// What to do once the modal the user is looking at is answered.
#[derive(Debug, Clone, PartialEq)]
pub enum Pending {
    /// Close these tabs; the first is the one being asked about.
    CloseTabs(Vec<String>),
    /// Save hit a disk mtime newer than ours.
    Conflict(String),
    /// Quit, asking about each remaining dirty tab in turn.
    Quit(Vec<String>),
}

#[derive(Debug, Clone)]
pub enum Message {
    WindowOpened(window::Id),
    CloseRequested(window::Id),
    Resized(Size),
    Moved(Point),
    FileDropped(PathBuf),
    OpenFileClicked,
    OpenFolderClicked,
    FilePicked(Option<PathBuf>),
    FolderPicked(Option<PathBuf>),
    SaveAsPicked(String, Option<PathBuf>),
    PersistTick(Instant),
}

/// Last known window geometry in physical pixels, for `state.json`. While
/// maximized this keeps the last un-maximized bounds.
#[derive(Debug, Clone, Copy, Default)]
pub struct WindowGeom {
    pub position: Option<Point>,
    pub size: Option<Size>,
    pub maximized: bool,
}

pub fn window_settings() -> window::Settings {
    // TODO(unit 11): restore size/position from state (position only if it
    // overlaps a connected monitor).
    window::Settings {
        size: Size::new(1180.0, 760.0),
        min_size: Some(Size::new(640.0, 420.0)),
        decorations: cfg!(target_os = "macos"),
        exit_on_close_request: false,
        ..window::Settings::default()
    }
}

/// Startup: re-grant remembered paths, drop missing recents, restore the
/// folder and tabs. TODO(unit 11): pins, active tab, geometry, zoom.
pub fn restore(app: &mut App) -> Task<AppMessage> {
    let Ok(dto) = notes_core::load_state(&app.config_dir) else { return Task::none() };
    for p in dto.recent_files.iter().chain(&dto.open_tabs).chain(&dto.last_folder) {
        let _ = notes_core::grant_path_access(p, &mut app.granted);
    }
    if let Some(t) = dto.theme.as_deref().and_then(crate::theme::ThemeId::parse) {
        app.theme = t;
    }
    app.session.read_dto(&dto);
    if let Some(folder) = app.session.open_folder.clone() {
        load_tree(app, &folder);
    }
    for p in &dto.open_tabs {
        let _ = open_path(app, p, false);
    }
    Task::none()
}

fn load_tree(app: &mut App, folder: &str) {
    match notes_core::read_dir_tree(folder.to_string(), &app.granted) {
        Ok(tree) => app.sidebar.tree = Some(tree),
        Err(e) => app.overlay.toast(ToastKind::Error, e.to_string()),
    }
}

pub fn update(app: &mut App, message: Message) -> Task<AppMessage> {
    match message {
        Message::WindowOpened(id) => {
            app.window_id = Some(id);
            Task::none()
        }
        Message::CloseRequested(_) => request_quit(app),
        Message::Resized(s) => {
            app.window_geom.size = Some(s);
            schedule_persist(app);
            Task::none()
        }
        Message::Moved(p) => {
            app.window_geom.position = Some(p);
            schedule_persist(app);
            Task::none()
        }
        Message::FileDropped(path) => {
            // TODO(unit 11): a dropped directory becomes the open folder.
            let p = path.to_string_lossy().into_owned();
            let _ = notes_core::grant_path_access(&p, &mut app.granted);
            open_path(app, &p, false)
        }
        Message::OpenFileClicked => pick_file(),
        Message::OpenFolderClicked => pick_folder(),
        Message::FilePicked(Some(path)) => {
            let p = path.to_string_lossy().into_owned();
            let _ = notes_core::grant_path_access(&p, &mut app.granted);
            open_path(app, &p, false)
        }
        Message::FolderPicked(Some(path)) => {
            let p = path.to_string_lossy().into_owned();
            let _ = notes_core::grant_path_access(&p, &mut app.granted);
            app.session.open_folder = Some(p.clone());
            load_tree(app, &p);
            schedule_persist(app);
            Task::none()
        }
        Message::SaveAsPicked(key, Some(path)) => {
            // TODO(unit 11): add .md if no extension, refuse a path open in
            // another tab, re-key session + buffer.
            let p = path.to_string_lossy().into_owned();
            let _ = notes_core::grant_path_access(&p, &mut app.granted);
            let new_key = app.session.rekey(&key, &p);
            if let Some(buf) = app.buffers.remove(&key) {
                app.buffers.insert(new_key.clone(), buf);
            }
            save(app, &new_key)
        }
        Message::FilePicked(None) | Message::FolderPicked(None) | Message::SaveAsPicked(_, None) => Task::none(),
        Message::PersistTick(now) => {
            if app.persist_due.is_some_and(|due| now >= due) {
                persist_now(app);
            }
            Task::none()
        }
    }
}

pub fn pick_file() -> Task<AppMessage> {
    Task::perform(
        async {
            rfd::AsyncFileDialog::new()
                .add_filter("Notes", &["md", "markdown", "txt"])
                .pick_file()
                .await
                .map(|h| h.path().to_path_buf())
        },
        |p| AppMessage::Io(Message::FilePicked(p)),
    )
}

pub fn pick_folder() -> Task<AppMessage> {
    Task::perform(
        async { rfd::AsyncFileDialog::new().pick_folder().await.map(|h| h.path().to_path_buf()) },
        |p| AppMessage::Io(Message::FolderPicked(p)),
    )
}

pub fn close_folder(app: &mut App) {
    app.session.open_folder = None;
    app.sidebar.tree = None;
    schedule_persist(app);
}

/// Opens `path` in a tab (reading it through notes-core), or activates it.
/// TODO(unit 11): de-dupe concurrent opens, lossy toast, loose-file tracking.
pub fn open_path(app: &mut App, path: &str, preview: bool) -> Task<AppMessage> {
    if app.buffers.contains_key(path) {
        app.session.activate(path);
        if !preview {
            app.session.promote(path);
        }
        return Task::none();
    }
    let read = match notes_core::read_text_file(path.to_string(), &app.granted) {
        Ok(r) => r,
        Err(e) => {
            app.overlay.toast(ToastKind::Error, e.to_string());
            return Task::none();
        }
    };
    let outcome = app.session.open_path(path, preview);
    if let Some(old) = &outcome.replaced {
        app.buffers.remove(old);
    }
    if outcome.created {
        app.buffers.insert(outcome.key.clone(), Buffer::new(&read.contents, editor::is_markdown_path(Some(path))));
        let mtime = notes_core::file_mtime_ms(path.to_string(), &app.granted).ok();
        if let Some(t) = app.session.tabs.get_mut(&outcome.key) {
            t.disk_mtime = mtime;
        }
    }
    schedule_persist(app);
    Task::none()
}

pub fn new_untitled(app: &mut App) {
    let key = app.session.new_untitled();
    app.buffers.insert(key, Buffer::new("", true));
}

/// Saves the tab at `key`; untitled tabs go to Save As.
/// TODO(unit 11): mtime conflict check → `Modal::conflict`.
pub fn save(app: &mut App, key: &str) -> Task<AppMessage> {
    let Some(tab) = app.session.tabs.get(key) else { return Task::none() };
    let Some(path) = tab.path.clone() else { return save_as(app, key) };
    let Some(buf) = app.buffers.get(key) else { return Task::none() };
    match notes_core::write_text_file(path.clone(), buf.text(), &app.granted) {
        Ok(()) => {
            let mtime = notes_core::file_mtime_ms(path, &app.granted).ok();
            if let Some(t) = app.session.tabs.get_mut(key) {
                t.dirty = false;
                t.disk_mtime = mtime;
            }
        }
        Err(e) => app.overlay.toast(ToastKind::Error, e.to_string()),
    }
    Task::none()
}

pub fn save_as(_app: &mut App, key: &str) -> Task<AppMessage> {
    let key = key.to_string();
    Task::perform(
        async {
            rfd::AsyncFileDialog::new()
                .add_filter("Markdown", &["md"])
                .add_filter("Text", &["txt"])
                .save_file()
                .await
                .map(|h| h.path().to_path_buf())
        },
        move |p| AppMessage::Io(Message::SaveAsPicked(key.clone(), p)),
    )
}

/// Closes `keys`, prompting for the first dirty one.
pub fn request_close(app: &mut App, keys: Vec<String>) -> Task<AppMessage> {
    for (i, key) in keys.iter().enumerate() {
        if app.session.tabs.get(key).is_some_and(|t| t.dirty) {
            let name = crate::tabs::title(&app.session.tabs[key]);
            app.overlay.ask(Modal::unsaved(&name, Pending::CloseTabs(keys[i..].to_vec())));
            return Task::none();
        }
        close_now(app, key);
    }
    Task::none()
}

fn close_now(app: &mut App, key: &str) {
    app.session.close(key);
    app.buffers.remove(key);
    schedule_persist(app);
}

/// TODO(unit 11): single "Save All" prompt, capture geometry, flush state.
pub fn request_quit(app: &mut App) -> Task<AppMessage> {
    let dirty = app.session.dirty_keys();
    if let Some(first) = dirty.first() {
        let name = crate::tabs::title(&app.session.tabs[first]);
        app.overlay.ask(Modal::unsaved(&name, Pending::Quit(dirty)));
        return Task::none();
    }
    persist_now(app);
    iced::exit()
}

/// Continues whatever the modal was asked for.
pub fn resolve(app: &mut App, choice: Choice, pending: Pending) -> Task<AppMessage> {
    match (choice, pending) {
        (Choice::Cancel, _) => Task::none(),
        (c, Pending::CloseTabs(keys)) => {
            let (first, rest) = keys.split_first().expect("non-empty");
            if c == Choice::Save {
                let _ = save(app, first);
            }
            close_now(app, first);
            request_close(app, rest.to_vec())
        }
        (c, Pending::Quit(keys)) => {
            if c == Choice::Save {
                for k in &keys {
                    let _ = save(app, k);
                }
            }
            persist_now(app);
            iced::exit()
        }
        (_, Pending::Conflict(_)) => Task::none(),
    }
}

/// TODO(unit 11): open the containing folder with the OS file manager.
pub fn reveal(_path: &str) -> Task<AppMessage> {
    Task::none()
}

pub fn schedule_persist(app: &mut App) {
    app.persist_due = Some(Instant::now() + PERSIST_DEBOUNCE);
}

pub fn persist_now(app: &mut App) {
    app.persist_due = None;
    let mut dto = notes_core::load_state(&app.config_dir).unwrap_or_default();
    app.session.write_dto(&mut dto);
    dto.theme = Some(app.theme.as_str().to_string());
    dto.zoom = Some(app.zoom as f64);
    dto.editor_zoom = Some(app.editor_zoom as f64);
    dto.sidebar_width = Some(app.sidebar.width as f64);
    if let Err(e) = notes_core::save_state(&app.config_dir, dto) {
        app.overlay.toast(ToastKind::Error, e.to_string());
    }
}

pub fn subscription(app: &App) -> Subscription<AppMessage> {
    let events = iced::event::listen_with(|event, _status, id| match event {
        iced::Event::Window(window::Event::Opened { .. }) => Some(Message::WindowOpened(id)),
        iced::Event::Window(window::Event::CloseRequested) => Some(Message::CloseRequested(id)),
        iced::Event::Window(window::Event::Resized(s)) => Some(Message::Resized(s)),
        iced::Event::Window(window::Event::Moved(p)) => Some(Message::Moved(p)),
        iced::Event::Window(window::Event::FileDropped(p)) => Some(Message::FileDropped(p)),
        _ => None,
    });
    let persist = if app.persist_due.is_some() {
        iced::time::every(Duration::from_millis(100)).map(Message::PersistTick)
    } else {
        Subscription::none()
    };
    Subscription::batch([events, persist]).map(AppMessage::Io)
}

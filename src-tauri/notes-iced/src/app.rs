//! The application shell: state, top-level message routing, and layout.
//!
//! Every UI module owns its own `Message` and reports back through an
//! `Action` (or `Event`/`Outcome`) enum; this file only routes those into
//! `session` and `io`. Keep it thin — units should add behaviour in their own
//! module rather than here.

use crate::editor::{self, Buffer};
use crate::io::{self, WindowGeom};
use crate::logic::{doc_stats, pathutil};
use crate::overlay;
use crate::quick_open;
use crate::session::Session;
use crate::shortcuts::{self, Shortcut};
use crate::sidebar;
use crate::statusbar;
use crate::tabs;
use crate::theme::{self, ThemeId};
use crate::titlebar;
use iced::widget::{button, column, container, opaque, row, stack, text};
use iced::{window, Element, Length, Subscription, Task};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::{Duration, Instant};

pub fn run() -> iced::Result {
    iced::application(App::boot, App::update, App::view)
        .title(App::title)
        .theme(App::theme)
        .scale_factor(|app: &App| app.zoom)
        .subscription(App::subscription)
        .window(io::window_settings())
        .run()
}

pub struct App {
    /// Consent set for notes-core: only paths the user picked, dropped, or
    /// that were restored from `state.json` are readable/writable.
    pub granted: HashSet<PathBuf>,
    pub config_dir: PathBuf,
    pub session: Session,
    /// Editor buffers keyed like `session.tabs`.
    pub buffers: HashMap<String, Buffer>,
    pub theme: ThemeId,
    /// Whole-UI zoom (Ctrl +/-), applied as the scale factor.
    pub zoom: f32,
    /// Editor-font zoom (Ctrl+wheel over the editor).
    pub editor_zoom: f32,
    pub window_id: Option<window::Id>,
    pub window_geom: WindowGeom,
    pub persist_due: Option<Instant>,
    pub titlebar: titlebar::State,
    pub tabs: tabs::State,
    pub sidebar: sidebar::State,
    pub quick_open: Option<quick_open::State>,
    pub overlay: overlay::State,
}

#[derive(Debug, Clone)]
pub enum Message {
    Titlebar(titlebar::Message),
    Tabs(tabs::Message),
    Sidebar(sidebar::Message),
    Editor(editor::Message),
    Status(statusbar::Message),
    QuickOpen(quick_open::Message),
    Overlay(overlay::Message),
    Io(io::Message),
    Shortcut(Shortcut),
    /// `NOTES_ICED_SMOKE=1`: quit right after startup, for CI/e2e smoke runs.
    SmokeExit,
}

/// Where `state.json` lives. Same directory as the Tauri build, so both
/// apps share one session file.
fn config_dir() -> PathBuf {
    directories::ProjectDirs::from("com", "etienne", "notes")
        .map(|d| d.config_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from(".notes-iced"))
}

impl App {
    /// A blank app with no I/O performed — what tests construct.
    pub fn new(config_dir: PathBuf) -> Self {
        Self {
            granted: HashSet::new(),
            config_dir,
            session: Session::default(),
            buffers: HashMap::new(),
            theme: ThemeId::default(),
            zoom: 1.0,
            editor_zoom: 1.0,
            window_id: None,
            window_geom: WindowGeom::default(),
            persist_due: None,
            titlebar: titlebar::State::default(),
            tabs: tabs::State::default(),
            sidebar: sidebar::State::default(),
            quick_open: None,
            overlay: overlay::State::default(),
        }
    }

    fn boot() -> (Self, Task<Message>) {
        let mut app = Self::new(config_dir());
        let task = io::restore(&mut app);
        (app, task)
    }

    pub fn palette(&self) -> theme::Palette {
        theme::palette(self.theme)
    }

    fn title(&self) -> String {
        match self.session.active_tab() {
            Some(t) => format!("{}{} — Notes", if t.dirty { "● " } else { "" }, tabs::title(t)),
            None => "Notes".to_string(),
        }
    }

    fn theme(&self) -> iced::Theme {
        theme::iced_theme(self.theme)
    }

    /// Every path quick open can offer: folder files, loose files, recents.
    pub fn known_paths(&self) -> Vec<String> {
        fn walk(node: &notes_core::DirNode, out: &mut Vec<String>) {
            if !node.is_dir {
                out.push(node.path.clone());
            }
            for c in node.children.iter().flatten() {
                walk(c, out);
            }
        }
        let mut out = Vec::new();
        if let Some(tree) = &self.sidebar.tree {
            walk(tree, &mut out);
        }
        out.extend(self.session.loose_files.iter().cloned());
        out.extend(self.session.recent.iter().cloned());
        let mut seen = HashSet::new();
        out.retain(|p| seen.insert(p.clone()));
        out
    }

    pub fn open_quick_open(&mut self) -> Task<Message> {
        let (state, task) = quick_open::open(self.known_paths());
        self.quick_open = Some(state);
        task.map(Message::QuickOpen)
    }

    pub fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Titlebar(m) => match titlebar::update(&mut self.titlebar, m, self.window_id) {
                titlebar::Outcome::Task(t) => t.map(Message::Titlebar),
                titlebar::Outcome::CloseRequested => io::request_quit(self),
            },
            Message::Tabs(m) => match tabs::update(&mut self.tabs, m) {
                Some(action) => self.on_tab_action(action),
                None => Task::none(),
            },
            Message::Sidebar(m) => match sidebar::update(&mut self.sidebar, m) {
                Some(sidebar::Action::OpenFolder) => io::pick_folder(),
                Some(sidebar::Action::CloseFolder) => {
                    io::close_folder(self);
                    Task::none()
                }
                Some(sidebar::Action::Preview(p)) => io::open_path(self, &p, true),
                Some(sidebar::Action::Open(p)) => io::open_path(self, &p, false),
                Some(sidebar::Action::RemoveLoose(p)) => {
                    self.session.loose_files.retain(|x| *x != p);
                    io::schedule_persist(self);
                    Task::none()
                }
                Some(sidebar::Action::Resized) => {
                    io::schedule_persist(self);
                    Task::none()
                }
                None => Task::none(),
            },
            Message::Editor(m) => {
                let Some(key) = self.session.active.clone() else { return Task::none() };
                let Some(buf) = self.buffers.get_mut(&key) else { return Task::none() };
                match editor::update(buf, m) {
                    Some(editor::Event::Edited) => {
                        self.session.set_dirty(&key, true);
                        self.session.promote(&key);
                    }
                    Some(editor::Event::Zoom(d)) => {
                        self.editor_zoom = (self.editor_zoom + d).clamp(editor::MIN_ZOOM, editor::MAX_ZOOM);
                        io::schedule_persist(self);
                    }
                    None => {}
                }
                Task::none()
            }
            Message::Status(statusbar::Message::SetTheme(t)) => {
                self.theme = t;
                io::schedule_persist(self);
                Task::none()
            }
            Message::QuickOpen(m) => {
                let Some(state) = self.quick_open.as_mut() else { return Task::none() };
                match quick_open::update(state, m) {
                    Some(quick_open::Action::Open(p)) => {
                        self.quick_open = None;
                        io::open_path(self, &p, false)
                    }
                    Some(quick_open::Action::Close) => {
                        self.quick_open = None;
                        Task::none()
                    }
                    None => Task::none(),
                }
            }
            Message::Overlay(m) => match overlay::update(&mut self.overlay, m) {
                Some(overlay::Action::Resolved(choice, pending)) => io::resolve(self, choice, pending),
                None => Task::none(),
            },
            Message::Io(m) => io::update(self, m),
            Message::Shortcut(s) => shortcuts::dispatch(self, s),
            Message::SmokeExit => iced::exit(),
        }
    }

    fn on_tab_action(&mut self, action: tabs::Action) -> Task<Message> {
        match action {
            tabs::Action::Activate(k) => self.session.activate(&k),
            tabs::Action::Promote(k) => self.session.promote(&k),
            tabs::Action::Close(k) => return io::request_close(self, vec![k]),
            tabs::Action::TogglePin(k) => self.session.toggle_pin(&k),
            tabs::Action::CloseOthers(k) => {
                let keys = self.session.others_keys(&k);
                return io::request_close(self, keys);
            }
            tabs::Action::CloseAll => {
                let keys = self.session.all_keys();
                return io::request_close(self, keys);
            }
            tabs::Action::Reveal(k) => return io::reveal(&k),
            tabs::Action::CopyPath(k) => return iced::clipboard::write(k),
        }
        io::schedule_persist(self);
        Task::none()
    }

    fn status_info(&self) -> statusbar::Info {
        let Some(tab) = self.session.active_tab() else { return statusbar::Info::default() };
        let Some(buf) = self.buffers.get(&tab.key) else { return statusbar::Info::default() };
        let (line, column) = buf.cursor();
        let stats = doc_stats::compute(&buf.text());
        statusbar::Info {
            path: tab.path.clone(),
            dirty: tab.dirty,
            line,
            column,
            words: stats.words,
            chars: stats.chars,
            markdown: buf.markdown,
        }
    }

    pub fn view(&self) -> Element<'_, Message> {
        let palette = self.palette();
        let title = match self.session.active_tab() {
            Some(t) => t.path.as_deref().map(pathutil::basename).map(str::to_string).unwrap_or_else(|| tabs::title(t)),
            None => "Notes".to_string(),
        };
        let editor: Element<'_, Message> = match self.session.active.as_ref().and_then(|k| self.buffers.get(k)) {
            Some(buf) => editor::view(buf, &palette, self.editor_zoom).map(Message::Editor),
            None => empty_state(),
        };
        let body = column![
            titlebar::view(&self.titlebar, title, &palette).map(Message::Titlebar),
            row![
                sidebar::view(&self.sidebar, &self.session, &palette).map(Message::Sidebar),
                column![tabs::view(&self.tabs, &self.session, &palette).map(Message::Tabs), editor],
            ]
            .height(Length::Fill),
            statusbar::view(self.status_info(), self.theme, &palette).map(Message::Status),
        ];

        let mut layers = stack![container(body).width(Length::Fill).height(Length::Fill)];
        if let Some(q) = &self.quick_open {
            layers = layers.push(opaque(quick_open::view(q, &palette).map(Message::QuickOpen)));
        }
        if let Some(t) = overlay::toasts_view(&self.overlay, &palette) {
            layers = layers.push(t.map(Message::Overlay));
        }
        if let Some(m) = overlay::modal_view(&self.overlay, &palette) {
            layers = layers.push(opaque(m.map(Message::Overlay)));
        }
        layers.into()
    }

    fn subscription(&self) -> Subscription<Message> {
        let smoke = if std::env::var_os("NOTES_ICED_SMOKE").is_some() {
            iced::time::every(Duration::from_millis(1500)).map(|_| Message::SmokeExit)
        } else {
            Subscription::none()
        };
        Subscription::batch([
            io::subscription(self),
            shortcuts::subscription(),
            overlay::subscription(&self.overlay).map(Message::Overlay),
            smoke,
        ])
    }
}

fn empty_state<'a>() -> Element<'a, Message> {
    container(
        column![
            text("No file open"),
            row![
                button(text("Open File")).on_press(Message::Io(io::Message::OpenFileClicked)),
                button(text("Open Folder")).on_press(Message::Io(io::Message::OpenFolderClicked)),
            ]
            .spacing(8),
        ]
        .spacing(12),
    )
    .center(Length::Fill)
    .into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use iced_test::simulator;

    /// Reference pattern for headless UI tests: render, interact through the
    /// simulator, feed the produced messages back through `update`, assert.
    #[test]
    fn untitled_tab_appears_in_strip_and_closes() {
        let dir = tempfile::tempdir().unwrap();
        let mut app = App::new(dir.path().to_path_buf());
        io::new_untitled(&mut app);

        let mut ui = simulator(app.view());
        assert!(ui.find("Untitled-1").is_ok());
        let _ = ui.click("×");
        let messages: Vec<_> = ui.into_messages().collect();
        for m in messages {
            let _ = app.update(m);
        }
        assert!(app.session.tabs.is_empty());
        assert!(app.buffers.is_empty());
    }
}

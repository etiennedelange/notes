//! Global keyboard shortcuts (Ctrl, or Cmd on macOS). Port of the keydown
//! handler in `src/app.ts`. Ignored while the modal is open.
//!
//! TODO(unit 11): the full table below, UI zoom (0.5–2.0) applied to the
//! whole UI, Ctrl+wheel outside the editor zooms the UI.

use crate::app::{App, Message as AppMessage};
use crate::io;
use iced::keyboard::{self, key::Named, Key, Modifiers};
use iced::{Subscription, Task};

pub const MIN_UI_ZOOM: f32 = 0.5;
pub const MAX_UI_ZOOM: f32 = 2.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shortcut {
    QuickOpen,
    Save,
    SaveAs,
    OpenFile,
    OpenFolder,
    NewUntitled,
    CloseTab,
    ReopenClosed,
    NextTab,
    PrevTab,
    ZoomIn,
    ZoomOut,
    ZoomReset,
}

pub fn map(key: &Key, mods: Modifiers) -> Option<Shortcut> {
    if !mods.command() {
        return None;
    }
    let shift = mods.shift();
    Some(match key.as_ref() {
        Key::Character("p") => Shortcut::QuickOpen,
        Key::Character("s") if shift => Shortcut::SaveAs,
        Key::Character("s") => Shortcut::Save,
        Key::Character("o") if shift => Shortcut::OpenFolder,
        Key::Character("o") => Shortcut::OpenFile,
        Key::Character("n") => Shortcut::NewUntitled,
        Key::Character("w") => Shortcut::CloseTab,
        Key::Character("t") if shift => Shortcut::ReopenClosed,
        Key::Named(Named::Tab) if shift => Shortcut::PrevTab,
        Key::Named(Named::Tab) => Shortcut::NextTab,
        Key::Character("=") | Key::Character("+") => Shortcut::ZoomIn,
        Key::Character("-") => Shortcut::ZoomOut,
        Key::Character("0") => Shortcut::ZoomReset,
        _ => return None,
    })
}

pub fn subscription() -> Subscription<AppMessage> {
    keyboard::listen().filter_map(|event| match event {
        keyboard::Event::KeyPressed { key, modifiers, .. } => map(&key, modifiers).map(AppMessage::Shortcut),
        _ => None,
    })
}

pub fn dispatch(app: &mut App, shortcut: Shortcut) -> Task<AppMessage> {
    if app.overlay.modal.is_some() {
        return Task::none();
    }
    let active = app.session.active.clone();
    match shortcut {
        Shortcut::QuickOpen => app.open_quick_open(),
        Shortcut::Save => active.map_or(Task::none(), |k| io::save(app, &k)),
        Shortcut::SaveAs => active.map_or(Task::none(), |k| io::save_as(app, &k)),
        Shortcut::OpenFile => io::pick_file(),
        Shortcut::OpenFolder => io::pick_folder(),
        Shortcut::NewUntitled => {
            io::new_untitled(app);
            Task::none()
        }
        Shortcut::CloseTab => active.map_or(Task::none(), |k| io::request_close(app, vec![k])),
        Shortcut::ReopenClosed => match app.session.pop_closed() {
            Some(p) => io::open_path(app, &p, false),
            None => Task::none(),
        },
        Shortcut::NextTab | Shortcut::PrevTab => {
            app.session.cycle(shortcut == Shortcut::NextTab);
            Task::none()
        }
        Shortcut::ZoomIn | Shortcut::ZoomOut | Shortcut::ZoomReset => {
            app.zoom = match shortcut {
                Shortcut::ZoomIn => app.zoom + 0.1,
                Shortcut::ZoomOut => app.zoom - 0.1,
                _ => 1.0,
            }
            .clamp(MIN_UI_ZOOM, MAX_UI_ZOOM);
            io::schedule_persist(app);
            Task::none()
        }
    }
}

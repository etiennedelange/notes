//! Folder tree and "Pinned Files". Port of `src/sidebar.ts` plus the resizer
//! in `src/app.ts`.
//!
//! TODO(unit 7): recursive tree with chevrons/icons and expand/collapse,
//! single-click preview vs double-click open, active and dirty markers,
//! truncated/empty messages, pinned-files remove buttons, draggable resizer
//! (MIN_WIDTH..=MAX_WIDTH, double-click resets), "Ctrl P quick open" hint.

use crate::logic::pathutil::basename;
use crate::session::Session;
use crate::theme::Palette;
use iced::widget::{button, column, container, text};
use iced::{Element, Length};
use notes_core::DirNode;
use std::collections::HashSet;

pub const MIN_WIDTH: f32 = 160.0;
pub const MAX_WIDTH: f32 = 480.0;
pub const DEFAULT_WIDTH: f32 = 240.0;

#[derive(Debug)]
pub struct State {
    pub width: f32,
    pub tree: Option<DirNode>,
    /// Paths of expanded directories; not persisted.
    pub expanded: HashSet<String>,
}

impl Default for State {
    fn default() -> Self {
        Self { width: DEFAULT_WIDTH, tree: None, expanded: HashSet::new() }
    }
}

#[derive(Debug, Clone)]
pub enum Message {
    OpenFolderClicked,
    CloseFolderClicked,
    ToggleDir(String),
    FileClicked(String),
    FileDoubleClicked(String),
    RemoveLoose(String),
    ResizeDrag(f32),
    ResizeReset,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    OpenFolder,
    CloseFolder,
    Preview(String),
    Open(String),
    RemoveLoose(String),
    /// Width changed; the app persists it.
    Resized,
}

pub fn update(state: &mut State, message: Message) -> Option<Action> {
    match message {
        Message::OpenFolderClicked => Some(Action::OpenFolder),
        Message::CloseFolderClicked => Some(Action::CloseFolder),
        Message::ToggleDir(p) => {
            if !state.expanded.remove(&p) {
                state.expanded.insert(p);
            }
            None
        }
        Message::FileClicked(p) => Some(Action::Preview(p)),
        Message::FileDoubleClicked(p) => Some(Action::Open(p)),
        Message::RemoveLoose(p) => Some(Action::RemoveLoose(p)),
        Message::ResizeDrag(w) => {
            state.width = w.clamp(MIN_WIDTH, MAX_WIDTH);
            Some(Action::Resized)
        }
        Message::ResizeReset => {
            state.width = DEFAULT_WIDTH;
            Some(Action::Resized)
        }
    }
}

pub fn view<'a>(state: &'a State, session: &'a Session, _palette: &Palette) -> Element<'a, Message> {
    let mut col = column![];
    match &state.tree {
        None => col = col.push(button(text("Open Folder")).on_press(Message::OpenFolderClicked)),
        Some(root) => {
            col = col.push(text(root.name.clone()));
            for child in root.children.iter().flatten().filter(|c| !c.is_dir) {
                col = col.push(button(text(child.name.clone())).on_press(Message::FileClicked(child.path.clone())));
            }
        }
    }
    for p in &session.loose_files {
        col = col.push(button(text(basename(p).to_string())).on_press(Message::FileClicked(p.clone())));
    }
    container(col).width(Length::Fixed(state.width)).height(Length::Fill).into()
}

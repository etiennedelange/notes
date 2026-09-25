//! Tab strip. Port of `src/tabs.ts`.
//!
//! TODO(unit 6): active/dirty/preview(italic)/pinned styling, dirty dot that
//! swaps with the close button on hover, double-click promote, middle-click
//! close, themed right-click menu, horizontal scroll keeping the active tab
//! visible. The stub is a plain row of buttons.

use crate::logic::pathutil::basename;
use crate::session::Session;
use crate::theme::Palette;
use iced::widget::{button, row, text};
use iced::Element;

#[derive(Debug, Default)]
pub struct State {
    /// Key of the tab whose context menu is open.
    pub menu_for: Option<String>,
}

#[derive(Debug, Clone)]
pub enum Message {
    Clicked(String),
    DoubleClicked(String),
    CloseClicked(String),
    OpenMenu(String),
    DismissMenu,
    Menu(Action),
}

/// Requests for the app; `Close*` go through the dirty-prompt flow in `io`.
#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Activate(String),
    Promote(String),
    Close(String),
    TogglePin(String),
    CloseOthers(String),
    CloseAll,
    Reveal(String),
    CopyPath(String),
}

pub fn update(state: &mut State, message: Message) -> Option<Action> {
    match message {
        Message::Clicked(k) => Some(Action::Activate(k)),
        Message::DoubleClicked(k) => Some(Action::Promote(k)),
        Message::CloseClicked(k) => Some(Action::Close(k)),
        Message::OpenMenu(k) => {
            state.menu_for = Some(k);
            None
        }
        Message::DismissMenu => {
            state.menu_for = None;
            None
        }
        Message::Menu(a) => {
            state.menu_for = None;
            Some(a)
        }
    }
}

pub fn title(tab: &crate::session::Tab) -> String {
    match &tab.path {
        Some(p) => basename(p).to_string(),
        None => format!("Untitled-{}", tab.key.trim_start_matches("untitled:")),
    }
}

pub fn view<'a>(_state: &'a State, session: &'a Session, _palette: &Palette) -> Element<'a, Message> {
    row(session.ordered().map(|t| {
        let label = if t.dirty { format!("● {}", title(t)) } else { title(t) };
        row![
            button(text(label)).on_press(Message::Clicked(t.key.clone())),
            button(text("×")).on_press(Message::CloseClicked(t.key.clone())),
        ]
        .into()
    }))
    .spacing(4)
    .into()
}

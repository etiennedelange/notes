//! Ctrl+P quick open. Port of `src/commandPalette.ts`. (Named `quick_open`
//! to avoid clashing with `theme::Palette`.)
//!
//! TODO(unit 9): fuzzy filter over `name + " " + dir` with `logic::fuzzy`,
//! empty query sorted by recent then name, max 100 results, matched-char
//! highlighting, Up/Down/Enter/Esc, click result, click backdrop to close,
//! autofocus the input. Rendered by the app as an overlay layer.

use crate::theme::Palette;
use iced::widget::{button, column, text, text_input};
use iced::{Element, Task};

pub const MAX_RESULTS: usize = 100;

#[derive(Debug, Default)]
pub struct State {
    pub query: String,
    pub selected: usize,
    /// Snapshot of `App::known_paths()` taken when opened.
    pub paths: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum Message {
    QueryChanged(String),
    Up,
    Down,
    Submit,
    Pick(String),
    Dismiss,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Open(String),
    Close,
}

pub fn open(paths: Vec<String>) -> (State, Task<Message>) {
    (State { paths, ..State::default() }, Task::none())
}

pub fn update(state: &mut State, message: Message) -> Option<Action> {
    match message {
        Message::QueryChanged(q) => {
            state.query = q;
            state.selected = 0;
            None
        }
        Message::Up => {
            state.selected = state.selected.saturating_sub(1);
            None
        }
        Message::Down => {
            state.selected += 1;
            None
        }
        Message::Submit => state.paths.get(state.selected).cloned().map(Action::Open),
        Message::Pick(p) => Some(Action::Open(p)),
        Message::Dismiss => Some(Action::Close),
    }
}

pub fn view<'a>(state: &'a State, _palette: &Palette) -> Element<'a, Message> {
    let mut col = column![text_input("Go to file…", &state.query)
        .on_input(Message::QueryChanged)
        .on_submit(Message::Submit)];
    for p in state.paths.iter().take(MAX_RESULTS) {
        col = col.push(button(text(p.clone())).on_press(Message::Pick(p.clone())));
    }
    col.into()
}

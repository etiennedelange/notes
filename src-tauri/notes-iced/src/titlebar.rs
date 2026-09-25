//! Custom titlebar for the undecorated window. Port of `src/titlebar.ts`.
//! On macOS the window keeps native decorations and this bar only draws the
//! title (see `app::window_settings`).
//!
//! TODO(unit 8): drag area (`window::drag`), double-click to toggle maximize,
//! minimize/maximize-restore/close buttons with the icon tracking maximized
//! state, app mark, hidden buttons on macOS, styling from `Palette`.

use crate::theme::Palette;
use iced::widget::{button, row, text};
use iced::{window, Element, Task};

#[derive(Debug, Default)]
pub struct State {
    pub maximized: bool,
}

#[derive(Debug, Clone)]
pub enum Message {
    Drag,
    DoubleClick,
    Minimize,
    ToggleMaximize,
    Close,
    /// From a window-resize subscription, to swap the maximize icon.
    MaximizedChanged(bool),
}

pub enum Outcome {
    Task(Task<Message>),
    /// The close button: routed through the app's quit prompt, never closed
    /// directly, so dirty tabs are never lost.
    CloseRequested,
}

pub fn update(state: &mut State, message: Message, id: Option<window::Id>) -> Outcome {
    let Some(id) = id else { return Outcome::Task(Task::none()) };
    match message {
        Message::Drag => Outcome::Task(window::drag(id)),
        Message::DoubleClick | Message::ToggleMaximize => Outcome::Task(window::toggle_maximize(id)),
        Message::Minimize => Outcome::Task(window::minimize(id, true)),
        Message::Close => Outcome::CloseRequested,
        Message::MaximizedChanged(m) => {
            state.maximized = m;
            Outcome::Task(Task::none())
        }
    }
}

pub fn view<'a>(_state: &'a State, title: String, _palette: &Palette) -> Element<'a, Message> {
    row![
        text(title),
        button(text("–")).on_press(Message::Minimize),
        button(text("□")).on_press(Message::ToggleMaximize),
        button(text("✕")).on_press(Message::Close),
    ]
    .spacing(4)
    .into()
}

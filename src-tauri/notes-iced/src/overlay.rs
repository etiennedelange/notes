//! Themed modal and toasts. Port of `src/modal.ts` and `src/toast.ts`.
//!
//! The modal is request/response over messages: `io` calls `State::ask` with
//! a `Pending` continuation, and the button press comes back to `io::resolve`
//! as `Action::Resolved(choice, pending)`.
//!
//! TODO(unit 10): real modal card over a dimmed backdrop (backdrop click =
//! Cancel), danger styling, Esc = Cancel, Enter = focused button, Tab focus
//! trap; toasts in a corner that expire after TOAST_MS via `subscription`.

use crate::io::Pending;
use crate::theme::Palette;
use iced::widget::{button, column, row, text};
use iced::{Element, Subscription};
use std::time::{Duration, Instant};

pub const TOAST_MS: u64 = 3200;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Choice {
    Save,
    DontSave,
    Cancel,
    Reload,
    Overwrite,
}

#[derive(Debug, Clone)]
pub struct Modal {
    pub title: String,
    pub message: String,
    pub danger: bool,
    /// Left to right; the last one is the default (Enter).
    pub buttons: Vec<(String, Choice)>,
    pub pending: Pending,
}

impl Modal {
    /// "Save changes to X?" — Cancel / Don't Save / Save.
    pub fn unsaved(name: &str, pending: Pending) -> Self {
        Self {
            title: "Unsaved changes".into(),
            message: format!("Do you want to save the changes you made to {name}?"),
            danger: false,
            buttons: vec![
                ("Cancel".into(), Choice::Cancel),
                ("Don't Save".into(), Choice::DontSave),
                ("Save".into(), Choice::Save),
            ],
            pending,
        }
    }

    /// The file changed on disk since it was opened — Cancel / Reload / Overwrite.
    pub fn conflict(name: &str, pending: Pending) -> Self {
        Self {
            title: "File changed on disk".into(),
            message: format!("{name} was modified outside Notes since you opened it."),
            danger: true,
            buttons: vec![
                ("Cancel".into(), Choice::Cancel),
                ("Reload from Disk".into(), Choice::Reload),
                ("Overwrite".into(), Choice::Overwrite),
            ],
            pending,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToastKind {
    Info,
    Error,
}

#[derive(Debug, Clone)]
pub struct Toast {
    pub kind: ToastKind,
    pub text: String,
    pub shown_at: Instant,
}

#[derive(Debug, Default)]
pub struct State {
    pub modal: Option<Modal>,
    pub toasts: Vec<Toast>,
}

impl State {
    pub fn ask(&mut self, modal: Modal) {
        self.modal = Some(modal);
    }

    pub fn toast(&mut self, kind: ToastKind, text: impl Into<String>) {
        self.toasts.push(Toast { kind, text: text.into(), shown_at: Instant::now() });
    }
}

#[derive(Debug, Clone)]
pub enum Message {
    Pressed(Choice),
    Tick(Instant),
}

#[derive(Debug, Clone)]
pub enum Action {
    Resolved(Choice, Pending),
}

pub fn update(state: &mut State, message: Message) -> Option<Action> {
    match message {
        Message::Pressed(choice) => state.modal.take().map(|m| Action::Resolved(choice, m.pending)),
        Message::Tick(now) => {
            state.toasts.retain(|t| now.duration_since(t.shown_at) < Duration::from_millis(TOAST_MS));
            None
        }
    }
}

pub fn subscription(state: &State) -> Subscription<Message> {
    if state.toasts.is_empty() {
        Subscription::none()
    } else {
        iced::time::every(Duration::from_millis(250)).map(Message::Tick)
    }
}

/// The modal layer, if one is open.
pub fn modal_view<'a>(state: &'a State, _palette: &Palette) -> Option<Element<'a, Message>> {
    let m = state.modal.as_ref()?;
    let buttons = row(m.buttons.iter().map(|(label, c)| button(text(label.clone())).on_press(Message::Pressed(*c)).into()));
    Some(column![text(m.title.clone()), text(m.message.clone()), buttons].spacing(8).into())
}

/// The toast stack, if any are live.
pub fn toasts_view<'a>(state: &'a State, _palette: &Palette) -> Option<Element<'a, Message>> {
    if state.toasts.is_empty() {
        return None;
    }
    Some(column(state.toasts.iter().map(|t| text(t.text.clone()).into())).into())
}

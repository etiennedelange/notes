//! Status bar. Port of `src/statusbar.ts`.
//!
//! TODO(unit 8): left: path + "• unsaved"; right: `Ln X, Col Y`, "N words,
//! M chars" (via `logic::doc_stats`), "Markdown"/"Plain Text", and the theme
//! swatch switcher (accent dot on the theme's bg). Styling from `Palette`.

use crate::theme::{Palette, ThemeId};
use iced::widget::{button, row, text};
use iced::Element;

/// Everything the bar shows, computed by the app from the active tab.
#[derive(Debug, Clone, Default)]
pub struct Info {
    pub path: Option<String>,
    pub dirty: bool,
    pub line: usize,
    pub column: usize,
    pub words: usize,
    pub chars: usize,
    pub markdown: bool,
}

#[derive(Debug, Clone)]
pub enum Message {
    SetTheme(ThemeId),
}

pub fn view<'a>(info: Info, current: ThemeId, _palette: &Palette) -> Element<'a, Message> {
    let mut r = row![
        text(info.path.unwrap_or_default()),
        text(format!("Ln {}, Col {}", info.line, info.column)),
    ]
    .spacing(12);
    for t in ThemeId::ALL {
        let label = if t == current { format!("[{}]", t.label()) } else { t.label().to_string() };
        r = r.push(button(text(label)).on_press(Message::SetTheme(t)));
    }
    r.into()
}

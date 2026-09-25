//! Markdown highlighter for `text_editor`, replacing lezer-markdown plus
//! `@codemirror/language-data` and `codeBlockBackground.ts`.
//!
//! Highlights carry already-resolved colours (from `Settings::theme`) rather
//! than abstract tags, because `text_editor::highlight_with` only gives the
//! format function an `&iced::Theme`, which can't reach our `Palette`.
//!
//! TODO(unit 4): markdown scopes, per-language fenced code via syntect, and
//! fence-line marking. This stub highlights nothing.

use crate::theme::ThemeId;
use iced::advanced::text::highlighter::{self, Highlighter};
use iced::{Color, Font};
use std::ops::Range;

#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub theme: ThemeId,
    /// `.txt` files get no highlighting at all.
    pub markdown: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Highlight {
    pub color: Option<Color>,
    pub font: Option<Font>,
}

/// The `to_format` passed to `text_editor::highlight_with`.
pub fn format(highlight: &Highlight, _theme: &iced::Theme) -> highlighter::Format<Font> {
    highlighter::Format { color: highlight.color, font: highlight.font }
}

pub struct MarkdownHighlighter {
    settings: Settings,
    current_line: usize,
}

impl Highlighter for MarkdownHighlighter {
    type Settings = Settings;
    type Highlight = Highlight;
    type Iterator<'a> = std::vec::IntoIter<(Range<usize>, Highlight)>;

    fn new(settings: &Settings) -> Self {
        Self { settings: settings.clone(), current_line: 0 }
    }

    fn update(&mut self, new_settings: &Settings) {
        self.settings = new_settings.clone();
        self.current_line = 0;
    }

    fn change_line(&mut self, line: usize) {
        self.current_line = self.current_line.min(line);
    }

    fn highlight_line(&mut self, _line: &str) -> Self::Iterator<'_> {
        self.current_line += 1;
        Vec::new().into_iter()
    }

    fn current_line(&self) -> usize {
        self.current_line
    }
}

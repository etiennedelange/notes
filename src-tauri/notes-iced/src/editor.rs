//! The editor pane: one `text_editor::Content` per tab, shown one at a time.
//! Replaces `src/editor.ts` (CodeMirror) and the paste handler in
//! `src/pasteCode.ts`.
//!
//! TODO(unit 5): Tab-to-indent key binding, soft wrap, Ctrl+wheel editor zoom,
//! paste-as-code via `logic::paste_code`, gutter/line numbers if feasible,
//! styling from `Palette`. Undo/redo is whatever `text_editor` provides.

use crate::highlight::{self, MarkdownHighlighter};
use crate::theme::{self, Palette};
use iced::widget::text_editor;
use iced::{Element, Length};

pub const MIN_ZOOM: f32 = 0.5;
pub const MAX_ZOOM: f32 = 2.5;

pub struct Buffer {
    pub content: text_editor::Content,
    pub markdown: bool,
}

impl Buffer {
    pub fn new(text: &str, markdown: bool) -> Self {
        Self { content: text_editor::Content::with_text(text), markdown }
    }

    pub fn text(&self) -> String {
        self.content.text()
    }

    /// 1-based (line, column), as the status bar shows it.
    pub fn cursor(&self) -> (usize, usize) {
        let pos = self.content.cursor().position;
        (pos.line + 1, pos.column + 1)
    }
}

pub fn is_markdown_path(path: Option<&str>) -> bool {
    // Untitled tabs default to markdown, matching the Tauri app.
    path.is_none_or(|p| {
        let p = p.to_lowercase();
        p.ends_with(".md") || p.ends_with(".markdown")
    })
}

#[derive(Debug, Clone)]
pub enum Message {
    Action(text_editor::Action),
    /// Ctrl+wheel over the editor; positive zooms in.
    Zoom(f32),
}

/// What the app must react to after an editor update.
#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    /// The text changed: mark dirty and promote a preview tab.
    Edited,
    Zoom(f32),
}

pub fn update(buffer: &mut Buffer, message: Message) -> Option<Event> {
    match message {
        Message::Action(action) => {
            let edit = action.is_edit();
            buffer.content.perform(action);
            edit.then_some(Event::Edited)
        }
        Message::Zoom(delta) => Some(Event::Zoom(delta)),
    }
}

pub fn view<'a>(buffer: &'a Buffer, palette: &Palette, editor_zoom: f32) -> Element<'a, Message> {
    text_editor(&buffer.content)
        .on_action(Message::Action)
        .size(theme::BASE_EDITOR_FONT_PX * editor_zoom)
        .height(Length::Fill)
        .highlight_with::<MarkdownHighlighter>(
            highlight::Settings { theme: palette.id, markdown: buffer.markdown },
            highlight::format,
        )
        .into()
}

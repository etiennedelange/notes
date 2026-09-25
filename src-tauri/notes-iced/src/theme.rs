//! Theme tokens and Iced styling. Port of `src/themes.ts`.
//!
//! TODO(unit 2): add tokyo-night and noctis-lux (every theme currently returns
//! Nord), widget style functions, and the highlight colour map. Every other
//! module reads colours from `Palette` — never hard-code a colour elsewhere.

use iced::Color;

pub const BASE_EDITOR_FONT_PX: f32 = 14.5;
pub const EDITOR_LINE_HEIGHT: f32 = 1.65;
pub const TAB_HEIGHT: f32 = 38.0;
pub const STATUSBAR_HEIGHT: f32 = 30.0;
pub const TITLEBAR_HEIGHT: f32 = 36.0;
pub const RADIUS: f32 = 6.0;
pub const RADIUS_LG: f32 = 9.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum ThemeId {
    #[default]
    Nord,
    TokyoNight,
    NoctisLux,
}

impl ThemeId {
    pub const ALL: [ThemeId; 3] = [ThemeId::Nord, ThemeId::TokyoNight, ThemeId::NoctisLux];

    /// The id persisted in `state.json`, shared with the Tauri app.
    pub fn as_str(self) -> &'static str {
        match self {
            ThemeId::Nord => "nord",
            ThemeId::TokyoNight => "tokyo-night",
            ThemeId::NoctisLux => "noctis-lux",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|t| t.as_str() == s)
    }

    pub fn label(self) -> &'static str {
        match self {
            ThemeId::Nord => "Nord",
            ThemeId::TokyoNight => "Tokyo Night",
            ThemeId::NoctisLux => "Noctis Lux",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Dark,
    Light,
}

/// Same token set as `ThemeTokens` in `src/themes.ts`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Palette {
    pub id: ThemeId,
    pub kind: Kind,
    pub bg: Color,
    pub bg_elevated: Color,
    pub bg_highlight: Color,
    pub border: Color,
    pub border_strong: Color,
    pub fg: Color,
    pub fg_muted: Color,
    pub fg_subtle: Color,
    pub accent: Color,
    pub accent_text: Color,
    pub accent_soft: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    pub selection: Color,
    pub caret: Color,
}

const fn hex(rgb: u32) -> Color {
    Color::from_rgb8((rgb >> 16) as u8, (rgb >> 8) as u8, rgb as u8)
}

const fn rgba(r: u8, g: u8, b: u8, a: f32) -> Color {
    Color::from_rgba8(r, g, b, a)
}

const NORD: Palette = Palette {
    id: ThemeId::Nord,
    kind: Kind::Dark,
    bg: hex(0x2e3440),
    bg_elevated: hex(0x3b4252),
    bg_highlight: hex(0x434c5e),
    border: hex(0x4c566a),
    border_strong: hex(0x5e6b84),
    fg: hex(0xeceff4),
    fg_muted: hex(0xd8dee9),
    fg_subtle: hex(0x9aa7bd),
    accent: hex(0x88c0d0),
    accent_text: hex(0x88c0d0),
    accent_soft: rgba(136, 192, 208, 0.16),
    success: hex(0xa3be8c),
    warning: hex(0xebcb8b),
    danger: hex(0xbf616a),
    selection: rgba(136, 192, 208, 0.25),
    caret: hex(0x88c0d0),
};

pub fn palette(id: ThemeId) -> Palette {
    match id {
        ThemeId::Nord | ThemeId::TokyoNight | ThemeId::NoctisLux => NORD,
    }
}

/// The `iced::Theme` handed to the runtime; built-in widgets pick up these
/// colours by default before any per-widget style function applies.
pub fn iced_theme(id: ThemeId) -> iced::Theme {
    let p = palette(id);
    iced::Theme::custom(
        id.label().to_string(),
        iced::theme::Palette {
            background: p.bg,
            text: p.fg,
            primary: p.accent,
            success: p.success,
            warning: p.warning,
            danger: p.danger,
        },
    )
}

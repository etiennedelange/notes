//! Notes, drawn with Iced instead of a webview.
//!
//! Exploratory: this crate is a parallel UI over `notes-core`, built to find
//! out how much of the Tauri/CodeMirror app survives without HTML/CSS. The
//! Tauri app in `../src` stays the shipping build.

// Scaffold stubs define API the parallel units fill in; drop this once the
// iced-rewrite units have all landed and every item has a caller.
#![allow(dead_code)]

mod app;
mod editor;
mod highlight;
mod io;
mod logic;
mod overlay;
mod quick_open;
mod session;
mod shortcuts;
mod sidebar;
mod statusbar;
mod tabs;
mod theme;
mod titlebar;

fn main() -> iced::Result {
    app::run()
}

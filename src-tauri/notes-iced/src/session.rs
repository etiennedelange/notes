//! Tab and session model, free of any UI type. Port of the tab bookkeeping in
//! `src/app.ts`.
//!
//! Keys: a file tab's key is its path; an untitled tab's key is `untitled:N`.
//! Editor buffers live in `App::buffers` under the same key — whenever this
//! model drops or re-keys a tab, the caller must do the same to the buffer.
//!
//! TODO(unit 3): preview-tab replacement rules, pinned ordering, closed-tab
//! stack cap (20), recent cap (30), `cycle`, `rekey`, DTO round-trip, tests.
//! The stubs below are just enough for the shell to run.

use notes_core::AppStateDto;
use std::collections::HashMap;

pub const MAX_CLOSED: usize = 20;
pub const MAX_RECENT: usize = 30;

#[derive(Debug, Clone, PartialEq)]
pub struct Tab {
    pub key: String,
    pub path: Option<String>,
    pub dirty: bool,
    pub disk_mtime: Option<u64>,
    pub pinned: bool,
}

impl Tab {
    pub fn is_untitled(&self) -> bool {
        self.path.is_none()
    }
}

/// What `open_path` did, so the caller knows which buffers to create or drop.
#[derive(Debug, Clone, PartialEq)]
pub struct OpenOutcome {
    pub key: String,
    /// False if the path was already open and was only activated.
    pub created: bool,
    /// A clean preview tab this open replaced; its buffer must be dropped.
    pub replaced: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Session {
    pub tabs: HashMap<String, Tab>,
    pub order: Vec<String>,
    pub active: Option<String>,
    pub preview: Option<String>,
    /// Paths of closed file tabs, most recent last.
    pub closed: Vec<String>,
    /// Most recent first.
    pub recent: Vec<String>,
    /// Files opened from outside `open_folder` ("Pinned Files" in the sidebar).
    pub loose_files: Vec<String>,
    pub open_folder: Option<String>,
    pub untitled_counter: u32,
}

impl Session {
    pub fn new_untitled(&mut self) -> String {
        self.untitled_counter += 1;
        let key = format!("untitled:{}", self.untitled_counter);
        self.insert(Tab { key: key.clone(), path: None, dirty: false, disk_mtime: None, pinned: false });
        self.active = Some(key.clone());
        key
    }

    /// Opens (or activates) a file tab. `preview` opens it as the single
    /// replaceable peek tab.
    pub fn open_path(&mut self, path: &str, preview: bool) -> OpenOutcome {
        let _ = preview;
        if self.tabs.contains_key(path) {
            self.active = Some(path.to_string());
            return OpenOutcome { key: path.to_string(), created: false, replaced: None };
        }
        self.insert(Tab { key: path.to_string(), path: Some(path.to_string()), dirty: false, disk_mtime: None, pinned: false });
        self.active = Some(path.to_string());
        self.touch_recent(path);
        OpenOutcome { key: path.to_string(), created: true, replaced: None }
    }

    fn insert(&mut self, tab: Tab) {
        self.order.push(tab.key.clone());
        self.tabs.insert(tab.key.clone(), tab);
    }

    pub fn activate(&mut self, key: &str) {
        if self.tabs.contains_key(key) {
            self.active = Some(key.to_string());
        }
    }

    /// Turns the preview tab into a normal tab (edit or double-click).
    pub fn promote(&mut self, key: &str) {
        if self.preview.as_deref() == Some(key) {
            self.preview = None;
        }
    }

    pub fn toggle_pin(&mut self, key: &str) {
        if let Some(t) = self.tabs.get_mut(key) {
            t.pinned = !t.pinned;
        }
    }

    /// Removes the tab unconditionally — the dirty prompt is the caller's job.
    pub fn close(&mut self, key: &str) -> Option<Tab> {
        let tab = self.tabs.remove(key)?;
        self.order.retain(|k| k != key);
        if self.preview.as_deref() == Some(key) {
            self.preview = None;
        }
        if self.active.as_deref() == Some(key) {
            self.active = self.order.last().cloned();
        }
        if let Some(p) = &tab.path {
            self.closed.push(p.clone());
        }
        Some(tab)
    }

    /// Keys Close Others would close (pinned tabs survive).
    pub fn others_keys(&self, key: &str) -> Vec<String> {
        self.order.iter().filter(|k| *k != key && !self.tabs[*k].pinned).cloned().collect()
    }

    /// Keys Close All would close (pinned tabs survive).
    pub fn all_keys(&self) -> Vec<String> {
        self.order.iter().filter(|k| !self.tabs[*k].pinned).cloned().collect()
    }

    /// Pops the most recently closed path that isn't already open.
    pub fn pop_closed(&mut self) -> Option<String> {
        self.closed.pop()
    }

    pub fn cycle(&mut self, _forward: bool) {}

    pub fn set_dirty(&mut self, key: &str, dirty: bool) {
        if let Some(t) = self.tabs.get_mut(key) {
            t.dirty = dirty;
        }
    }

    /// Save As: moves the tab at `old` to `new_path`, returning the new key.
    pub fn rekey(&mut self, old: &str, new_path: &str) -> String {
        let _ = old;
        new_path.to_string()
    }

    pub fn touch_recent(&mut self, path: &str) {
        self.recent.retain(|p| p != path);
        self.recent.insert(0, path.to_string());
    }

    pub fn active_tab(&self) -> Option<&Tab> {
        self.active.as_ref().and_then(|k| self.tabs.get(k))
    }

    pub fn ordered(&self) -> impl Iterator<Item = &Tab> {
        self.order.iter().filter_map(|k| self.tabs.get(k))
    }

    pub fn dirty_keys(&self) -> Vec<String> {
        self.ordered().filter(|t| t.dirty).map(|t| t.key.clone()).collect()
    }

    /// Writes the session fields of `dto`; UI fields (theme, zoom, window) are
    /// the app's. Untitled tabs are never persisted.
    pub fn write_dto(&self, dto: &mut AppStateDto) {
        dto.last_folder = self.open_folder.clone();
        dto.recent_files = self.recent.clone();
        dto.open_tabs = self.ordered().filter_map(|t| t.path.clone()).collect();
        dto.active_tab = self.active_tab().and_then(|t| t.path.clone());
        dto.pinned_tabs = self.ordered().filter(|t| t.pinned).filter_map(|t| t.path.clone()).collect();
    }

    /// Restores folder/recent from `dto`. Tabs are reopened by `io::restore`
    /// through `open_path`, since each needs a file read.
    pub fn read_dto(&mut self, dto: &AppStateDto) {
        self.open_folder = dto.last_folder.clone();
        self.recent = dto.recent_files.clone();
    }
}

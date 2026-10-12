//! In-app updates: the NSIS installer from GitHub Releases updates itself.
//!
//! The updater reads `latest.json` from the newest release (`plugins.updater` in
//! `tauri.conf.json`), and checks the downloaded installer against the public key there before
//! running it. `docs/RELEASING.md` covers the key and how `latest.json` is made.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

const RELEASES: &str = "https://github.com/etiennedelange/notes/releases";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    /// The release's CHANGELOG section.
    pub notes: Option<String>,
    /// RFC 3339, as published in latest.json.
    pub date: Option<String>,
}

/// Asks GitHub Releases (latest.json) whether a newer version exists. The webview only shows a
/// failure when the user asked; the startup check stays quiet.
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let found = async { app.updater()?.check().await }
        .await
        .map_err(|e| format!("Couldn't check for updates: {e}"))?;
    Ok(found.map(|u| UpdateInfo {
        date: u
            .raw_json
            .get("pub_date")
            .and_then(|d| d.as_str())
            .map(str::to_owned),
        version: u.version,
        notes: u.body,
    }))
}

/// An update downloaded by [`download_update`], waiting for [`install_update`].
#[derive(Default)]
pub struct Downloaded(Mutex<Option<(Update, Vec<u8>)>>);

/// Downloads the newest version and checks its signature, without installing it. Split from
/// [`install_update`] so the webview can ask about unsaved tabs after the download, right
/// before the app exits, and nothing typed while it downloads is lost.
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    downloaded: State<'_, Downloaded>,
) -> Result<String, String> {
    let failed = |e: tauri_plugin_updater::Error| format!("Couldn't update Notes: {e}");
    let update = app
        .updater()
        .map_err(failed)?
        .check()
        .await
        .map_err(failed)?
        .ok_or("Notes is already up to date.")?;
    let bytes = update.download(|_, _| {}, || {}).await.map_err(failed)?;
    let version = update.version.clone();
    *downloaded.0.lock().unwrap_or_else(|e| e.into_inner()) = Some((update, bytes));
    Ok(version)
}

/// Runs the installer that [`download_update`] fetched. The webview has already dealt with
/// unsaved tabs and saved the session: on Windows this process exits as soon as the installer
/// starts (passive mode: a progress bar, no questions), and the installer restarts Notes.
#[tauri::command]
pub fn install_update(app: AppHandle, downloaded: State<'_, Downloaded>) -> Result<(), String> {
    let (update, bytes) = downloaded
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .ok_or("No update has been downloaded.")?;
    update
        .install(bytes)
        .map_err(|e| format!("Couldn't update Notes: {e}"))?;
    // Only reached off Windows, where the new version is in place but not running yet.
    app.restart();
}

/// Opens the GitHub release page of `version`.
#[tauri::command]
pub fn open_release_page(app: AppHandle, version: String) -> Result<(), String> {
    let url = release_page(&version).ok_or_else(|| format!("\"{version}\" is not a version"))?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// The page for `version`, which comes from the webview, so only version characters get into
/// the URL.
fn release_page(version: &str) -> Option<String> {
    let valid = !version.is_empty()
        && version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    valid.then(|| format!("{RELEASES}/tag/v{version}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_page_takes_only_version_characters() {
        assert_eq!(
            release_page("0.5.0").as_deref(),
            Some("https://github.com/etiennedelange/notes/releases/tag/v0.5.0")
        );
        assert_eq!(
            release_page("1.0.0-beta.1").as_deref(),
            Some("https://github.com/etiennedelange/notes/releases/tag/v1.0.0-beta.1")
        );
        assert_eq!(release_page(""), None);
        assert_eq!(release_page("1.0/../../evil"), None);
        assert_eq!(release_page("1.0?x=y"), None);
    }
}

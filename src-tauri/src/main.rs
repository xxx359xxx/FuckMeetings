// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// WebView2 fails to create its user-data folder when the executable lives
/// under a path with non-ASCII characters (e.g. OneDrive "Документы"),
/// surfacing as "Access is denied (os error 5)". Point it at an ASCII path
/// under LOCALAPPDATA before Tauri spins up the webview.
#[cfg(windows)]
fn setup_webview2_data_dir() {
    use std::path::PathBuf;

    if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_some() {
        return;
    }

    let Some(local) = std::env::var_os("LOCALAPPDATA") else {
        return;
    };

    let dir = PathBuf::from(local)
        .join("InterviewKit")
        .join("WebView2");

    if std::fs::create_dir_all(&dir).is_ok() {
        // SAFETY: called once from main() before any other thread exists.
        unsafe {
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir);
        }
    }
}

fn main() {
    #[cfg(windows)]
    setup_webview2_data_dir();

    interview_kit_lib::run()
}

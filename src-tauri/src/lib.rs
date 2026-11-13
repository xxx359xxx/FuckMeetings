mod agents;
mod codex_connect;
mod claude_connect;
mod files;
mod llm;
mod local_models;
mod models;
#[cfg(desktop)]
mod migration;
mod macos_audio;
mod screen_capture;
mod transcribe;

use llm::AppState;
use tauri::Manager;

#[tauri::command]
fn updater_configured(app: tauri::AppHandle) -> bool {
    app.config().plugins.0.contains_key("updater")
}

#[tauri::command]
fn set_dock_icon_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { return app.set_dock_visibility(visible).map_err(|e| e.to_string()); }
    #[cfg(not(target_os = "macos"))]
    { let _ = (app, visible); Err("Dock доступен только в macOS".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }
    builder = builder
        .manage(AppState::default())
        .manage(screen_capture::CaptureState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            transcribe::transcribe_audio,
            transcribe::transcribe_deepgram,
            transcribe::check_deepgram_key,
            transcribe::transcribe_local,
            local_models::install_local_model,
            local_models::delete_local_model,
            local_models::list_local_models,
            local_models::activate_local_model,
            macos_audio::start_mac_audio,
            macos_audio::stop_mac_audio,
            macos_audio::start_mac_audio_stream,
            macos_audio::stop_mac_audio_stream,
            updater_configured,
            set_dock_icon_visible,
            screen_capture::capture_screen,
            screen_capture::open_selection,
            screen_capture::get_pending_capture,
            screen_capture::clear_pending_capture,
            llm::llm_chat,
            llm::llm_cancel,
            models::list_provider_models,
            agents::run_agent,
            codex_connect::connect_codex,
            claude_connect::connect_claude,
            files::read_file_base64,
            files::write_file_base64,
        ]);

    builder = builder.plugin(tauri_plugin_system_audio::init());
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_process::init());
        builder = builder.setup(|app| {
            migration::migrate(app.handle())?;
            if app.config().plugins.0.contains_key("updater") {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        });
    }
    #[cfg(target_os = "macos")]
    { builder = builder.manage(macos_audio::MacAudioState::default()); }

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                // Closing the primary window should also stop background CLI children.
                crate::agents::terminate_running_agents();
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod agents;
mod files;
mod llm;
mod local_models;
mod screen_capture;
mod transcribe;

use llm::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        use tauri::Manager;
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
            screen_capture::capture_screen,
            screen_capture::get_pending_capture,
            screen_capture::clear_pending_capture,
            llm::llm_chat,
            llm::llm_cancel,
            agents::run_agent,
            files::read_file_base64,
            files::write_file_base64,
        ]);

    builder = builder.plugin(tauri_plugin_system_audio::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::{io::Cursor, sync::Mutex};
use base64::Engine;
use tauri::{Manager, State};
#[derive(Default)]
pub struct CaptureState(Mutex<Option<String>>);
#[tauri::command]
pub async fn open_selection(app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("selection").is_none() {
        let config = app.config().app.windows.iter().find(|window| window.label == "selection")
            .ok_or("Не найдены настройки окна выбора области")?;
        tauri::WebviewWindowBuilder::from_config(&app, config).map_err(|e| e.to_string())?
            .build().map_err(|e| e.to_string())?;
    }
    let window = app.get_webview_window("selection").ok_or("Окно выбора области недоступно")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn capture_screen(state: State<'_, CaptureState>) -> Result<String, String> {
    let data = tauri::async_runtime::spawn_blocking(|| -> Result<String, String> {
        let screens = screenshots::Screen::all().map_err(|e| format!("Не удалось найти экран: {e}"))?;
        let screen = screens.iter().find(|s| s.display_info.is_primary).or_else(|| screens.first()).ok_or("Экран не найден")?;
        let pixels = screen.capture().map_err(|e| format!("Не удалось сделать снимок экрана: {e}"))?;
        let mut png = Cursor::new(Vec::new());
        screenshots::image::DynamicImage::ImageRgba8(pixels).write_to(&mut png, screenshots::image::ImageFormat::Png).map_err(|e| e.to_string())?;
        Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png.into_inner())))
    }).await.map_err(|e| e.to_string())??;
    *state.0.lock().map_err(|e| e.to_string())? = Some(data.clone()); Ok(data)
}
#[tauri::command]
pub fn get_pending_capture(state: State<'_, CaptureState>) -> Result<Option<String>, String> { Ok(state.0.lock().map_err(|e| e.to_string())?.clone()) }
#[tauri::command]
pub fn clear_pending_capture(state: State<'_, CaptureState>) -> Result<(), String> { *state.0.lock().map_err(|e| e.to_string())? = None; Ok(()) }

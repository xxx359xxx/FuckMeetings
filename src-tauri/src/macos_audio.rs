#[cfg(target_os = "macos")]
mod native {
    use base64::Engine;
    use std::{ffi::{CStr, CString, c_char}, path::Path, sync::{Mutex, OnceLock}};
    use tauri::{Manager, State};

    type Start = unsafe extern "C" fn(*const c_char, *mut c_char, i32) -> i32;
    type Stop = unsafe extern "C" fn(*mut c_char, i32) -> i32;
    // Keep Swift and its Objective-C classes loaded for the entire process lifetime.
    static LIBRARY: OnceLock<libloading::Library> = OnceLock::new();
    #[derive(Default)]
    pub struct MacAudioState(Mutex<Option<tempfile::TempDir>>);
    fn library(path: &Path) -> Result<&'static libloading::Library, String> {
        if let Some(lib) = LIBRARY.get() { return Ok(lib); }
        // The library is shipped inside this app, never downloaded at runtime.
        let lib = unsafe { libloading::Library::new(path) }.map_err(|e| format!("Не удалось загрузить модуль системного звука: {e}"))?;
        let _ = LIBRARY.set(lib);
        LIBRARY.get().ok_or_else(|| "Модуль системного звука не загружен".into())
    }
    fn error_text(buffer: &[c_char]) -> String {
        unsafe { CStr::from_ptr(buffer.as_ptr()) }.to_string_lossy().into_owned()
    }
    #[tauri::command]
    pub async fn start_mac_audio(app: tauri::AppHandle, state: State<'_, MacAudioState>) -> Result<(), String> {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        if current.is_some() { return Err("Запись системного звука уже идёт".into()); }
        let path = app.path().resource_dir().map_err(|e| e.to_string())?.join("whisper/libsystem-audio.dylib");
        let lib = library(&path)?;
        let folder = tempfile::Builder::new().prefix("fuckmeetings-audio-").tempdir().map_err(|e| e.to_string())?;
        let path = CString::new(folder.path().join("system.wav").to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
        let mut message = [0 as c_char; 2048];
        let start = unsafe { lib.get::<Start>(b"fm_audio_start\0") }.map_err(|e| e.to_string())?;
        let status = unsafe { start(path.as_ptr(), message.as_mut_ptr(), message.len() as i32) };
        if status != 0 { return Err(format!("Не удалось запустить системный звук: {}", error_text(&message))); }
        *current = Some(folder); Ok(())
    }
    #[tauri::command]
    pub async fn stop_mac_audio(state: State<'_, MacAudioState>) -> Result<String, String> {
        let folder = state.0.lock().map_err(|e| e.to_string())?.take().ok_or("Запись системного звука не запущена")?;
        let lib = LIBRARY.get().ok_or("Модуль системного звука не загружен")?;
        let stop = unsafe { lib.get::<Stop>(b"fm_audio_stop\0") }.map_err(|e| e.to_string())?;
        let mut message = [0 as c_char; 2048];
        let status = unsafe { stop(message.as_mut_ptr(), message.len() as i32) };
        if status != 0 { return Err(format!("Запись системного звука прервана: {}", error_text(&message))); }
        let bytes = std::fs::read(folder.path().join("system.wav")).map_err(|e| format!("Не удалось получить системный звук: {e}"))?;
        if bytes.len() <= 44 { return Err("Системный звук не получен. Проверьте воспроизведение звука.".into()); }
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    }
}
#[cfg(target_os = "macos")]
pub use native::*;
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn start_mac_audio() -> Result<(), String> { Err("Доступно только в macOS".into()) }
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn stop_mac_audio() -> Result<String, String> { Err("Доступно только в macOS".into()) }

#[cfg(target_os = "macos")]
mod native {
    use base64::Engine;
    use std::{ffi::{CStr, CString, c_char}, path::Path, sync::{Mutex, OnceLock}};
    use tauri::{ipc::Channel, Manager, State};

    type Start = unsafe extern "C" fn(*const c_char, *mut c_char, i32) -> i32;
    type StartStream = unsafe extern "C" fn(extern "C" fn(*const i16, i32), extern "C" fn(*const c_char), *mut c_char, i32) -> i32;
    type Stop = unsafe extern "C" fn(*mut c_char, i32) -> i32;
    // Keep Swift and its Objective-C classes loaded for the entire process lifetime.
    static LIBRARY: OnceLock<libloading::Library> = OnceLock::new();
    static STREAM_CHANNEL: Mutex<Option<Channel<MacAudioEvent>>> = Mutex::new(None);
    #[derive(Clone, serde::Serialize)]
    #[serde(tag = "kind", rename_all = "snake_case")]
    pub enum MacAudioEvent {
        Pcm { samples_base64: String },
        Failure { message: String },
    }
    enum Session { Meeting(tempfile::TempDir), Stream }
    #[derive(Default)]
    pub struct MacAudioState(Mutex<Option<Session>>);
    extern "C" fn on_audio(samples: *const i16, count: i32) {
        if samples.is_null() || count <= 0 { return; }
        let bytes = unsafe { std::slice::from_raw_parts(samples.cast::<u8>(), count as usize * 2) };
        if let Ok(channel) = STREAM_CHANNEL.lock() {
            if let Some(channel) = channel.as_ref() {
                let _ = channel.send(MacAudioEvent::Pcm { samples_base64: base64::engine::general_purpose::STANDARD.encode(bytes) });
            }
        }
    }
    extern "C" fn on_error(message: *const c_char) {
        if message.is_null() { return; }
        let message = unsafe { CStr::from_ptr(message) }.to_string_lossy().into_owned();
        if let Ok(channel) = STREAM_CHANNEL.lock() {
            if let Some(channel) = channel.as_ref() { let _ = channel.send(MacAudioEvent::Failure { message }); }
        }
    }
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
        *current = Some(Session::Meeting(folder)); Ok(())
    }
    #[tauri::command]
    pub async fn stop_mac_audio(state: State<'_, MacAudioState>) -> Result<String, String> {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        if !matches!(current.as_ref(), Some(Session::Meeting(_))) { return Err("Запись встречи не запущена".into()); }
        let Some(Session::Meeting(folder)) = current.take() else { unreachable!() };
        let lib = LIBRARY.get().ok_or("Модуль системного звука не загружен")?;
        let stop = unsafe { lib.get::<Stop>(b"fm_audio_stop\0") }.map_err(|e| e.to_string())?;
        let mut message = [0 as c_char; 2048];
        let status = unsafe { stop(message.as_mut_ptr(), message.len() as i32) };
        if status != 0 { return Err(format!("Запись системного звука прервана: {}", error_text(&message))); }
        let bytes = std::fs::read(folder.path().join("system.wav")).map_err(|e| format!("Не удалось получить системный звук: {e}"))?;
        if bytes.len() <= 44 { return Err("Системный звук не получен. Проверьте воспроизведение звука.".into()); }
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    }
    #[tauri::command]
    pub async fn start_mac_audio_stream(app: tauri::AppHandle, state: State<'_, MacAudioState>, channel: Channel<MacAudioEvent>) -> Result<(), String> {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        if current.is_some() { return Err("Запись системного звука уже идёт".into()); }
        let path = app.path().resource_dir().map_err(|e| e.to_string())?.join("whisper/libsystem-audio.dylib");
        let lib = library(&path)?;
        let start = unsafe { lib.get::<StartStream>(b"fm_audio_start_stream\0") }.map_err(|e| e.to_string())?;
        *STREAM_CHANNEL.lock().map_err(|e| e.to_string())? = Some(channel);
        let mut message = [0 as c_char; 2048];
        let status = unsafe { start(on_audio, on_error, message.as_mut_ptr(), message.len() as i32) };
        if status != 0 {
            *STREAM_CHANNEL.lock().map_err(|e| e.to_string())? = None;
            return Err(format!("Не удалось запустить системный звук: {}", error_text(&message)));
        }
        *current = Some(Session::Stream);
        Ok(())
    }
    #[tauri::command]
    pub async fn stop_mac_audio_stream(state: State<'_, MacAudioState>) -> Result<(), String> {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        if !matches!(current.as_ref(), Some(Session::Stream)) { return Err("Прослушивание системного звука не запущено".into()); }
        let lib = LIBRARY.get().ok_or("Модуль системного звука не загружен")?;
        let stop = unsafe { lib.get::<Stop>(b"fm_audio_stop\0") }.map_err(|e| e.to_string())?;
        let mut message = [0 as c_char; 2048];
        let status = unsafe { stop(message.as_mut_ptr(), message.len() as i32) };
        *STREAM_CHANNEL.lock().map_err(|e| e.to_string())? = None;
        *current = None;
        if status != 0 { return Err(format!("Запись системного звука прервана: {}", error_text(&message))); }
        Ok(())
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
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn start_mac_audio_stream(_channel: tauri::ipc::Channel<serde_json::Value>) -> Result<(), String> { Err("Доступно только в macOS".into()) }
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn stop_mac_audio_stream() -> Result<(), String> { Err("Доступно только в macOS".into()) }

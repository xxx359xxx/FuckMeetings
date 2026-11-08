use base64::Engine as _;

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Не удалось прочитать файл: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn write_file_base64(path: String, data_base64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| format!("Некорректные данные: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Не удалось записать файл: {e}"))?;
    Ok(())
}

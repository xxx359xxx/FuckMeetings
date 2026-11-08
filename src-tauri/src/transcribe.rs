use base64::Engine;

#[tauri::command]
pub async fn transcribe_audio(data: String, filename: String, base_url: String, api_key: String, model: String, language: String) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| format!("Ошибка аудиофайла: {e}"))?;
    if bytes.is_empty() { return Err("Аудиофайл пуст".into()); }
    let part = reqwest::multipart::Part::bytes(bytes).file_name(filename);
    let mut form = reqwest::multipart::Form::new().part("file", part).text("model", model);
    if !language.trim().is_empty() { form = form.text("language", language); }
    let url = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let mut request = client.post(url).multipart(form);
    if !api_key.is_empty() { request = request.bearer_auth(api_key); }
    let response = request.send().await.map_err(|e| format!("Ошибка подключения транскрибатора: {e}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("Транскрибатор HTTP {status}: {body}")); }
    let value: serde_json::Value = serde_json::from_str(&body).map_err(|_| format!("Транскрибатор вернул неверный JSON: {body}"))?;
    value.get("text").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()).map(str::to_owned).ok_or_else(|| "Транскрибатор не вернул текст".into())
}

#[tauri::command]
pub async fn check_deepgram_key(api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() { return Err("Введите API-ключ Deepgram.".into()); }
    let response = reqwest::Client::new().get("https://api.deepgram.com/v1/auth/token")
        .header("Authorization", format!("Token {}", api_key.trim())).send().await
        .map_err(|e| format!("Не удалось связаться с Deepgram: {e}"))?;
    if response.status().is_success() { Ok(()) }
    else { Err(format!("Deepgram отклонил проверку ключа: HTTP {}", response.status())) }
}

#[tauri::command]
pub async fn transcribe_deepgram(data: String, filename: String, api_key: String, model: String, language: String) -> Result<String, String> {
    request_deepgram("https://api.deepgram.com/v1/listen", data, filename, api_key, model, language).await
}

async fn request_deepgram(url: &str, data: String, filename: String, api_key: String, model: String, language: String) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| format!("Ошибка аудиофайла: {e}"))?;
    if bytes.is_empty() { return Err("Аудиофайл пуст".into()); }
    if api_key.trim().is_empty() { return Err("Укажите API-ключ Deepgram".into()); }
    let mime = match filename.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "wav" => "audio/wav", "mp3" => "audio/mpeg", "m4a" | "mp4" => "audio/mp4",
        "webm" => "audio/webm", "ogg" => "audio/ogg", "flac" => "audio/flac", "mpeg" => "audio/mpeg", _ => "application/octet-stream",
    };
    let client = reqwest::Client::new();
    let mut request = client.post(url).header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", mime).query(&[("model", model.trim()), ("smart_format", "true")]);
    if language.trim().is_empty() { request = request.query(&[("detect_language", "true")]); }
    else { request = request.query(&[("language", language.trim())]); }
    let response = request.body(bytes).send().await.map_err(|e| format!("Ошибка подключения Deepgram: {e}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() { return Err(format!("Deepgram HTTP {status}: {body}")); }
    let value: serde_json::Value = serde_json::from_str(&body).map_err(|_| "Deepgram вернул неверный JSON".to_string())?;
    value.pointer("/results/channels/0/alternatives/0/transcript").and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty()).map(str::to_owned).ok_or_else(|| "Deepgram не обнаружил речь в записи".into())
}

#[tauri::command]
pub async fn transcribe_local(data: String, executable: String, model_path: String, language: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::process::Command;
        let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| e.to_string())?;
        if bytes.is_empty() { return Err("Аудиофайл пуст".into()); }
        let id = format!("interviewkit-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos());
        let directory = std::env::temp_dir().join(id);
        std::fs::create_dir(&directory).map_err(|e| e.to_string())?;
        let result = (|| {
            let input = directory.join("audio.wav");
            let output = directory.join("transcript");
            std::fs::write(&input, bytes).map_err(|e| e.to_string())?;
            let mut cmd = Command::new(executable);
            cmd.arg("-m").arg(model_path).arg("-f").arg(&input).arg("-otxt").arg("-of").arg(&output).arg("-nt");
            cmd.arg("-l").arg(if language.trim().is_empty() { "auto" } else { language.trim() });
            #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
            let result = cmd.output().map_err(|e| format!("Не удалось запустить whisper.cpp: {e}"))?;
            if !result.status.success() { return Err(format!("whisper.cpp: {}", String::from_utf8_lossy(&result.stderr))); }
            let text = std::fs::read_to_string(output.with_extension("txt")).map_err(|e| format!("Не удалось прочитать результат whisper.cpp: {e}"))?;
            if text.trim().is_empty() { return Err("Транскрибатор не вернул текст".into()); }
            Ok(text)
        })();
        let _ = std::fs::remove_dir_all(directory);
        result
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn sends_audio_and_reads_transcription() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut request = Vec::new();
            let mut chunk = [0u8; 4096];
            loop {
                let n = socket.read(&mut chunk).unwrap();
                if n == 0 { break; }
                request.extend_from_slice(&chunk[..n]);
                if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length = headers.lines().find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").and_then(|v| v.trim().parse::<usize>().ok())).unwrap();
                    if request.len() >= end + 4 + length { break; }
                }
            }
            let text = String::from_utf8_lossy(&request);
            assert!(text.starts_with("POST /v1/audio/transcriptions "));
            assert!(text.contains("sample.wav"));
            assert!(text.contains("test-model"));
            let body = "{\"text\":\"Тест записи\"}";
            write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        let result = tauri::async_runtime::block_on(transcribe_audio(
            base64::engine::general_purpose::STANDARD.encode(b"fake audio"), "sample.wav".into(),
            format!("http://{address}/v1"), "".into(), "test-model".into(), "ru".into(),
        )).unwrap();
        server.join().unwrap();
        assert_eq!(result, "Тест записи");
    }

    #[test]
    fn deepgram_uses_raw_audio_and_extracts_transcript() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut request = Vec::new(); let mut chunk = [0u8; 4096];
            loop {
                let n = socket.read(&mut chunk).unwrap(); if n == 0 { break; }
                request.extend_from_slice(&chunk[..n]);
                if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]);
                    let length = headers.lines().find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").and_then(|v| v.trim().parse::<usize>().ok())).unwrap();
                    if request.len() >= end + 4 + length { break; }
                }
            }
            let text = String::from_utf8_lossy(&request);
            assert!(text.starts_with("POST /v1/listen?model=nova-3&smart_format=true&language=ru "));
            assert!(text.to_ascii_lowercase().contains("authorization: token test-key"));
            assert!(text.to_ascii_lowercase().contains("content-type: audio/wav"));
            assert!(text.ends_with("fake audio"));
            let body = r#"{"results":{"channels":[{"alternatives":[{"transcript":"Привет"}]}]}}"#;
            write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        let result = tauri::async_runtime::block_on(request_deepgram(
            &format!("http://{address}/v1/listen"),
            base64::engine::general_purpose::STANDARD.encode(b"fake audio"), "sample.wav".into(),
            "test-key".into(), "nova-3".into(), "ru".into(),
        )).unwrap();
        server.join().unwrap();
        assert_eq!(result, "Привет");
    }

}

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Default)]
pub struct AppState {
    pub cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LlmEvent {
    Delta { text: String },
    Done { text: String },
    Error { message: String },
}

#[derive(Clone, Copy)]
enum Wire {
    OpenAi,
    Anthropic,
    Gemini,
}

#[tauri::command]
pub async fn llm_chat(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    api_key: String,
    base_url: Option<String>,
    messages: Vec<ChatMessage>,
    request_id: String,
    on_event: Channel<LlmEvent>,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    state
        .cancels
        .lock()
        .unwrap()
        .insert(request_id.clone(), cancel.clone());

    let result = run_llm(provider, model, api_key, base_url, messages, cancel, &on_event).await;

    state.cancels.lock().unwrap().remove(&request_id);
    result
}

#[tauri::command]
pub fn llm_cancel(state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    let map = state.cancels.lock().unwrap();
    if let Some(flag) = map.get(&request_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

async fn run_llm(
    provider: String,
    model: String,
    api_key: String,
    base_url: Option<String>,
    messages: Vec<ChatMessage>,
    cancel: Arc<AtomicBool>,
    on_event: &Channel<LlmEvent>,
) -> Result<(), String> {
    if provider == "codex" {
        return run_codex(model, messages, cancel, on_event.clone()).await;
    }
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    match provider.as_str() {
        "anthropic" => {
            run_anthropic(&client, &model, &api_key, base_url, &messages, cancel, on_event).await
        }
        "gemini" => run_gemini(&client, &model, &api_key, base_url, &messages, cancel, on_event).await,
        _ => run_openai(&client, &model, &api_key, base_url, &messages, cancel, on_event).await,
    }
}

async fn run_openai(
    client: &reqwest::Client,
    model: &str,
    api_key: &str,
    base_url: Option<String>,
    messages: &[ChatMessage],
    cancel: Arc<AtomicBool>,
    on_event: &Channel<LlmEvent>,
) -> Result<(), String> {
    let base = base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let mut msgs = Vec::new();
    for m in messages {
        if m.images.is_empty() {
            msgs.push(serde_json::json!({"role": m.role, "content": m.content}));
        } else {
            let mut parts = Vec::new();
            if !m.content.is_empty() {
                parts.push(serde_json::json!({"type": "text", "text": m.content}));
            }
            for img in &m.images {
                parts.push(serde_json::json!({"type": "image_url", "image_url": {"url": img}}));
            }
            msgs.push(serde_json::json!({"role": m.role, "content": parts}));
        }
    }

    let body = serde_json::json!({"model": model, "messages": msgs, "stream": true});
    let mut req = client.post(&url).json(&body);
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {api_key}"));
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = on_event.send(LlmEvent::Error {
                message: format!("Ошибка сети: {e}"),
            });
            return Ok(());
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let _ = on_event.send(LlmEvent::Error {
            message: format!("HTTP {status}: {text}"),
        });
        return Ok(());
    }

    stream_sse(resp, Wire::OpenAi, cancel, on_event).await
}

async fn run_anthropic(
    client: &reqwest::Client,
    model: &str,
    api_key: &str,
    base_url: Option<String>,
    messages: &[ChatMessage],
    cancel: Arc<AtomicBool>,
    on_event: &Channel<LlmEvent>,
) -> Result<(), String> {
    let base = base_url.unwrap_or_else(|| "https://api.anthropic.com/v1".to_string());
    let url = format!("{}/messages", base.trim_end_matches('/'));

    let mut system: Option<String> = None;
    let mut msgs = Vec::new();
    for m in messages {
        if m.role == "system" {
            system = Some(match system {
                Some(s) => format!("{s}\n\n{}", m.content),
                None => m.content.clone(),
            });
            continue;
        }
        let role = if m.role == "assistant" { "assistant" } else { "user" };
        if m.images.is_empty() {
            msgs.push(serde_json::json!({"role": role, "content": m.content}));
        } else {
            let mut parts = Vec::new();
            if !m.content.is_empty() {
                parts.push(serde_json::json!({"type": "text", "text": m.content}));
            }
            for img in &m.images {
                let (mime, data) = parse_data_url(img);
                parts.push(serde_json::json!({
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": data}
                }));
            }
            msgs.push(serde_json::json!({"role": role, "content": parts}));
        }
    }

    let mut body = serde_json::json!({"model": model, "max_tokens": 8192, "messages": msgs, "stream": true});
    if let Some(s) = system {
        body["system"] = serde_json::json!(s);
    }

    let mut req = client
        .post(&url)
        .header("content-type", "application/json")
        .header("anthropic-version", "2023-06-01");
    if !api_key.is_empty() {
        req = req.header("x-api-key", api_key);
    }

    let resp = match req.json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = on_event.send(LlmEvent::Error {
                message: format!("Ошибка сети: {e}"),
            });
            return Ok(());
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let _ = on_event.send(LlmEvent::Error {
            message: format!("HTTP {status}: {text}"),
        });
        return Ok(());
    }

    stream_sse(resp, Wire::Anthropic, cancel, on_event).await
}

async fn run_gemini(
    client: &reqwest::Client,
    model: &str,
    api_key: &str,
    base_url: Option<String>,
    messages: &[ChatMessage],
    cancel: Arc<AtomicBool>,
    on_event: &Channel<LlmEvent>,
) -> Result<(), String> {
    let base =
        base_url.unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1beta".to_string());
    let url = format!(
        "{}/models/{}:streamGenerateContent?alt=sse",
        base.trim_end_matches('/'),
        model
    );

    let mut system: Option<String> = None;
    let mut contents = Vec::new();
    for m in messages {
        if m.role == "system" {
            system = Some(match system {
                Some(s) => format!("{s}\n\n{}", m.content),
                None => m.content.clone(),
            });
            continue;
        }
        let role = if m.role == "assistant" { "model" } else { "user" };
        let mut parts = Vec::new();
        if !m.content.is_empty() {
            parts.push(serde_json::json!({"text": m.content}));
        }
        for img in &m.images {
            let (mime, data) = parse_data_url(img);
            parts.push(serde_json::json!({"inlineData": {"mimeType": mime, "data": data}}));
        }
        contents.push(serde_json::json!({"role": role, "parts": parts}));
    }

    let mut body = serde_json::json!({"contents": contents});
    if let Some(s) = system {
        body["systemInstruction"] = serde_json::json!({"parts": [{"text": s}]});
    }

    let mut req = client.post(&url);
    if !api_key.is_empty() {
        req = req.header("x-goog-api-key", api_key);
    }

    let resp = match req.json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = on_event.send(LlmEvent::Error {
                message: format!("Ошибка сети: {e}"),
            });
            return Ok(());
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let _ = on_event.send(LlmEvent::Error {
            message: format!("HTTP {status}: {text}"),
        });
        return Ok(());
    }

    stream_sse(resp, Wire::Gemini, cancel, on_event).await
}

async fn stream_sse(
    resp: reqwest::Response,
    wire: Wire,
    cancel: Arc<AtomicBool>,
    on_event: &Channel<LlmEvent>,
) -> Result<(), String> {
    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    let mut full = String::new();

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let bytes = match chunk {
            Ok(b) => b,
            Err(e) => {
                let _ = on_event.send(LlmEvent::Error {
                    message: format!("Ошибка потока: {e}"),
                });
                return Ok(());
            }
        };
        buf.extend_from_slice(&bytes);

        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line = String::from_utf8_lossy(&buf[..pos]).trim_end_matches('\r').to_string();
            buf.drain(..pos + 1);

            let data = match line.strip_prefix("data:") {
                Some(d) => d.trim_start(),
                None => continue,
            };
            if data == "[DONE]" {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(error) = value.get("error") {
                    let message = error.get("message").and_then(|v| v.as_str()).unwrap_or("Сервис сообщил об ошибке во время ответа");
                    let _ = on_event.send(LlmEvent::Error { message: message.to_string() });
                    return Ok(());
                }
                let truncated = value.pointer("/choices/0/finish_reason").and_then(|v| v.as_str()) == Some("length")
                    || value.pointer("/delta/stop_reason").and_then(|v| v.as_str()) == Some("max_tokens")
                    || value.pointer("/candidates/0/finishReason").and_then(|v| v.as_str()) == Some("MAX_TOKENS");
                if truncated {
                    let _ = on_event.send(LlmEvent::Error { message: "Ответ оборван из-за лимита модели. Частичный текст сохранён ниже; попробуйте более короткий запрос или другую модель.".into() });
                    return Ok(());
                }
                if let Some(text) = extract_delta(wire, &value) {
                    if !text.is_empty() {
                        full.push_str(&text);
                        let _ = on_event.send(LlmEvent::Delta { text });
                    }
                }
            }
        }
    }

    let _ = on_event.send(LlmEvent::Done { text: full });
    Ok(())
}

fn extract_delta(wire: Wire, v: &serde_json::Value) -> Option<String> {
    match wire {
        Wire::OpenAi => v
            .get("choices")?
            .get(0)?
            .get("delta")?
            .get("content")?
            .as_str()
            .map(|s| s.to_string()),
        Wire::Anthropic => {
            if v.get("type")?.as_str()? == "content_block_delta" {
                v.get("delta")?
                    .get("text")?
                    .as_str()
                    .map(|s| s.to_string())
            } else {
                None
            }
        }
        Wire::Gemini => {
            let parts = v.pointer("/candidates/0/content/parts")?.as_array()?;
            let text = parts.iter().filter(|p| p.get("thought").and_then(|v| v.as_bool()) != Some(true))
                .filter_map(|p| p.get("text").and_then(|v| v.as_str())).collect::<String>();
            if text.is_empty() { None } else { Some(text) }
        },
    }
}

fn parse_data_url(s: &str) -> (String, String) {
    if let Some(rest) = s.strip_prefix("data:") {
        if let Some(idx) = rest.find(";base64,") {
            let mime = &rest[..idx];
            let data = &rest[idx + ";base64,".len()..];
            let mime = if mime.is_empty() {
                "image/png".to_string()
            } else {
                mime.to_string()
            };
            return (mime, data.to_string());
        }
    }
    ("image/png".to_string(), s.to_string())
}

async fn run_codex(model: String, messages: Vec<ChatMessage>, cancel: Arc<AtomicBool>, on_event: Channel<LlmEvent>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, BufReader, Write};
        use std::process::{Command, Stdio};
        use std::sync::mpsc;
        use base64::Engine;
        let image_dir = tempfile::Builder::new().prefix("interviewkit-images-").tempdir().map_err(|e| format!("Не удалось подготовить изображения: {e}"))?;
        let prompt = messages.iter().map(|m| format!("[{}]\n{}", m.role, m.content)).collect::<Vec<_>>().join("\n\n");
        let mut input = vec![serde_json::json!({"type":"text","text":prompt,"text_elements":[]})];
        for (index, image) in messages.iter().flat_map(|m| m.images.iter()).enumerate() {
            let (mime, encoded) = parse_data_url(image);
            let ext = match mime.as_str() { "image/jpeg" => "jpg", "image/webp" => "webp", "image/gif" => "gif", _ => "png" };
            let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e| format!("Неверное изображение: {e}"))?;
            let path = image_dir.path().join(format!("image-{index}.{ext}"));
            std::fs::write(&path, bytes).map_err(|e| format!("Не удалось подготовить изображение: {e}"))?;
            input.push(serde_json::json!({"type":"localImage","path":path.to_string_lossy()}));
        }
        let mut cmd = Command::new("codex");
        cmd.args(["app-server", "--listen", "stdio://"]).current_dir(std::env::temp_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
        let mut child = cmd.spawn().map_err(|e| format!("Не удалось запустить Codex: {e}"))?;
        let mut stdin = child.stdin.take().ok_or("Не удалось открыть ввод Codex")?;
        let stdout = child.stdout.take().ok_or("Не удалось открыть вывод Codex")?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || { for line in BufReader::new(stdout).lines() { match line { Ok(line) => { if tx.send(line).is_err() { break; } }, Err(_) => break } } });
        let send = |stdin: &mut std::process::ChildStdin, value: serde_json::Value| -> Result<(), String> {
            writeln!(stdin, "{}", value).map_err(|e| e.to_string())?; stdin.flush().map_err(|e| e.to_string())
        };
        send(&mut stdin, serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"interview_kit","version":"0.1.0"},"capabilities":{}}}))?;
        let mut answer = String::new();
        let result = loop {
            if cancel.load(Ordering::Relaxed) { break Err("Генерация отменена".to_string()); }
            let line = match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(line) => line,
                Err(mpsc::RecvTimeoutError::Timeout) => { if child.try_wait().map_err(|e| e.to_string())?.is_some() { break Err("Codex завершился до ответа".into()); } continue; },
                Err(_) => break Err("Соединение с Codex закрыто".into()),
            };
            let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if let Some(error) = event.get("error") { break Err(format!("Ошибка Codex: {error}")); }
            match event.get("id").and_then(|v| v.as_u64()) {
                Some(1) => {
                    send(&mut stdin, serde_json::json!({"method":"initialized"}))?;
                    let mut params = serde_json::json!({"cwd": std::env::temp_dir().to_string_lossy(), "approvalPolicy":"never", "sandbox":"read-only", "ephemeral":true});
                    if !model.trim().is_empty() { params["model"] = serde_json::json!(model.trim()); }
                    send(&mut stdin, serde_json::json!({"id":2,"method":"thread/start","params":params}))?;
                }
                Some(2) => {
                    let id = event.pointer("/result/thread/id").and_then(|v| v.as_str()).ok_or("Codex не создал диалог")?;
                    send(&mut stdin, serde_json::json!({"id":3,"method":"turn/start","params":{"threadId":id,"input":input,"effort":"low"}}))?;
                }
                _ => {}
            }
            match event.get("method").and_then(|v| v.as_str()) {
                Some("item/agentMessage/delta") => if let Some(text) = event.pointer("/params/delta").and_then(|v| v.as_str()) { answer.push_str(text); let _ = on_event.send(LlmEvent::Delta { text: text.to_string() }); },
                Some("turn/completed") => {
                    let status = event.pointer("/params/turn/status").and_then(|v| v.as_str()).unwrap_or("");
                    if status != "completed" || answer.is_empty() { break Err(format!("Codex не завершил ответ: {status}")); }
                    let _ = on_event.send(LlmEvent::Done { text: answer }); break Ok(());
                }
                _ => {}
            }
        };
        let _ = child.kill(); let _ = child.wait(); result
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod streaming_tests {
    use super::*;
    #[test]
    fn parses_provider_streams_and_ignores_gemini_thoughts() {
        let openai = serde_json::json!({"choices":[{"delta":{"content":"Привет"}}]});
        let claude = serde_json::json!({"type":"content_block_delta","delta":{"type":"text_delta","text":"мир"}});
        let gemini = serde_json::json!({"candidates":[{"content":{"parts":[{"thought":true,"text":"скрыто"},{"text":"Готов"},{"text":"о"}]}}]});
        assert_eq!(extract_delta(Wire::OpenAi, &openai).as_deref(), Some("Привет"));
        assert_eq!(extract_delta(Wire::Anthropic, &claude).as_deref(), Some("мир"));
        assert_eq!(extract_delta(Wire::Gemini, &gemini).as_deref(), Some("Готово"));
    }
    #[test]
    fn sends_requests_and_streams_responses_for_each_protocol() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use tauri::ipc::InvokeResponseBody;
        for (provider, path, payload) in [
            ("openai", "/chat/completions", r#"{"choices":[{"delta":{"content":"ответ"}}]}"#),
            ("anthropic", "/messages", r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"ответ"}}"#),
            ("gemini", "/models/test-model:streamGenerateContent?alt=sse", r#"{"candidates":[{"content":{"parts":[{"text":"ответ"}]}}]}"#),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap();
            let payload = payload.to_owned(); let path = path.to_owned();
            let server = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                let mut req = Vec::new(); let mut buf = [0u8; 8192];
                loop { let n = socket.read(&mut buf).unwrap(); if n == 0 { break; } req.extend_from_slice(&buf[..n]);
                    if let Some(pos) = req.windows(4).position(|b| b == b"\r\n\r\n") {
                        let head = String::from_utf8_lossy(&req[..pos]);
                        let len = head.lines().find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").and_then(|v| v.trim().parse::<usize>().ok())).unwrap_or(0);
                        if req.len() >= pos + 4 + len { break; }
                    }
                }
                let request = String::from_utf8(req).unwrap();
                assert!(request.starts_with(&format!("POST {} ", path)));
                assert!(request.contains("test-model") || path.contains("test-model"));
                let body = format!("data: {}\n\n", payload);
                write!(socket, "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
            });
            let events = Arc::new(Mutex::new(Vec::<String>::new())); let copy = events.clone();
            let channel = Channel::new(move |body| { if let InvokeResponseBody::Json(text) = body { copy.lock().unwrap().push(text); } Ok(()) });
            let messages = vec![ChatMessage { role: "user".into(), content: "тест".into(), images: vec![] }];
            tauri::async_runtime::block_on(run_llm(provider.into(), "test-model".into(), "test-key".into(), Some(format!("http://{}", addr)), messages, Arc::new(AtomicBool::new(false)), &channel)).unwrap();
            server.join().unwrap();
            let events = events.lock().unwrap();
            assert!(events.iter().any(|e| e.contains("ответ")), "missing streamed reply");
            assert!(events.iter().any(|e| e.contains("done")), "missing done event");
        }
    }

}

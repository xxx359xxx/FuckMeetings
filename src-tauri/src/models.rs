use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::time::{Duration, Instant};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModel {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
}

fn model(id: &str, display_name: Option<&str>, description: Option<&str>) -> Option<ProviderModel> {
    if id.trim().is_empty() {
        return None;
    }
    Some(ProviderModel {
        id: id.to_owned(),
        display_name: display_name.filter(|s| !s.is_empty()).map(str::to_owned),
        description: description.filter(|s| !s.is_empty()).map(str::to_owned),
    })
}

fn default_base(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("https://api.openai.com/v1"),
        "anthropic" => Some("https://api.anthropic.com/v1"),
        "gemini" => Some("https://generativelanguage.googleapis.com/v1beta"),
        "openrouter" => Some("https://openrouter.ai/api/v1"),
        "deepseek" => Some("https://api.deepseek.com"),
        "groq" => Some("https://api.groq.com/openai/v1"),
        "ollama" => Some("http://localhost:11434/v1"),
        _ => None,
    }
}

fn endpoint(provider: &str, base_url: Option<String>) -> Result<reqwest::Url, String> {
    let base = base_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .or_else(|| default_base(provider))
        .ok_or("Укажите адрес сервера моделей")?;
    let mut url = reqwest::Url::parse(base).map_err(|_| "Неверный адрес сервера моделей")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Неверный адрес сервера моделей".into());
    }
    let path = url.path().trim_end_matches('/');
    let path = if provider == "ollama" {
        // Ollama chat uses /v1, while the native tags endpoint lives at /api/tags.
        let root = path.strip_suffix("/v1").unwrap_or(path);
        format!("{root}/api/tags")
    } else {
        format!("{path}/models")
    };
    url.set_path(&path);
    Ok(url)
}

#[tauri::command]
pub async fn list_provider_models(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<ProviderModel>, String> {
    if provider == "codex" {
        return codex_models().await;
    }
    if provider == "claude-code" {
        return Ok(["sonnet", "opus", "haiku"].into_iter()
            .filter_map(|id| model(id, None, None)).collect());
    }
    if !matches!(
        provider.as_str(),
        "openai"
            | "anthropic"
            | "gemini"
            | "openrouter"
            | "deepseek"
            | "groq"
            | "ollama"
            | "custom"
    ) {
        return Err("Неизвестный провайдер моделей".into());
    }
    let url = endpoint(&provider, base_url)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "Не удалось подготовить запрос моделей")?;
    let mut found = Vec::new();
    let mut ids = HashSet::new();
    let mut cursor: Option<String> = None;
    let mut cursors = HashSet::new();
    let deadline = Instant::now() + Duration::from_secs(30);
    for _ in 0..50 {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("Время ожидания моделей истекло".into());
        }
        let mut page_url = url.clone();
        if let Some(next) = &cursor {
            if !cursors.insert(next.clone()) {
                return Err("Сервер повторил страницу моделей".into());
            }
            page_url.query_pairs_mut().append_pair(
                if provider == "gemini" {
                    "pageToken"
                } else {
                    "after_id"
                },
                next,
            );
        }
        let mut request = client
            .get(page_url)
            .timeout(remaining.min(Duration::from_secs(12)));
        if !api_key.is_empty() {
            request = match provider.as_str() {
                "anthropic" => request.header("x-api-key", &api_key),
                "gemini" => request.header("x-goog-api-key", &api_key),
                "ollama" => request,
                _ => request.bearer_auth(&api_key),
            };
        }
        if provider == "anthropic" {
            request = request.header("anthropic-version", "2023-06-01");
        }
        let response = request
            .send()
            .await
            .map_err(|_| "Не удалось получить список моделей (сеть или таймаут)")?;
        if !response.status().is_success() {
            return Err(format!(
                "Сервер моделей вернул HTTP {}",
                response.status().as_u16()
            ));
        }
        let body: Value = response
            .json()
            .await
            .map_err(|_| "Некорректный ответ сервера моделей")?;
        let entries = if provider == "gemini" || provider == "ollama" {
            body.get("models")
        } else {
            body.get("data")
        }
        .and_then(Value::as_array)
        .ok_or("В ответе сервера нет списка моделей")?;
        for entry in entries {
            if provider == "gemini"
                && entry
                    .get("supportedGenerationMethods")
                    .and_then(Value::as_array)
                    .is_some_and(|methods| {
                        !methods
                            .iter()
                            .any(|method| method.as_str() == Some("generateContent"))
                    })
            {
                continue;
            }
            let id = if provider == "gemini" {
                entry
                    .get("name")
                    .and_then(Value::as_str)
                    .and_then(|s| s.strip_prefix("models/"))
            } else if provider == "ollama" {
                entry.get("name").and_then(Value::as_str)
            } else {
                entry.get("id").and_then(Value::as_str)
            };
            let Some(id) = id else { continue };
            if ids.insert(id.to_owned()) {
                let display = entry
                    .get("displayName")
                    .or_else(|| entry.get("display_name"))
                    .and_then(Value::as_str);
                let description = entry.get("description").and_then(Value::as_str);
                if let Some(item) = model(id, display, description) {
                    found.push(item);
                }
            }
        }
        cursor = match provider.as_str() {
            "gemini" => body
                .get("nextPageToken")
                .and_then(Value::as_str)
                .map(str::to_owned),
            "anthropic" if body.get("has_more").and_then(Value::as_bool) == Some(true) => Some(
                body.get("last_id")
                    .and_then(Value::as_str)
                    .filter(|s| !s.is_empty())
                    .ok_or("Сервер не вернул курсор следующей страницы моделей")?
                    .to_owned(),
            ),
            _ => None,
        };
        if cursor.is_none() {
            return Ok(found);
        }
    }
    Err("Слишком много страниц моделей".into())
}

async fn codex_models() -> Result<Vec<ProviderModel>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        use std::io::{BufRead, BufReader, Write};
        use std::process::{Command, Stdio};
        use std::sync::mpsc;
        let mut command = Command::new(crate::codex_connect::find_codex()?);
        command.args(["app-server", "--listen", "stdio://"])
            .current_dir(std::env::temp_dir()).stdin(Stdio::piped())
            .stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
        let mut child = command.spawn().map_err(|_| "Не удалось запустить Codex")?;
        let result = (|| -> Result<Vec<ProviderModel>, String> {
            let mut input = child.stdin.take().ok_or("Не удалось открыть ввод Codex")?;
            let output = child.stdout.take().ok_or("Не удалось открыть вывод Codex")?;
            let (tx, rx) = mpsc::channel();
            std::thread::spawn(move || {
                for line in BufReader::new(output).lines().map_while(Result::ok) {
                    if tx.send(line).is_err() { break; }
                }
            });
            let mut send = |value: Value| -> Result<(), String> {
                writeln!(input, "{value}").and_then(|_| input.flush())
                    .map_err(|_| "Не удалось отправить запрос Codex".to_owned())
            };
            send(serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"fuckmeetings","version":"1.0.0"},"capabilities":{}}}))?;
            let deadline = Instant::now() + Duration::from_secs(15);
            let mut results = Vec::new();
            let mut ids = HashSet::new();
            let mut cursors = HashSet::new();
            let mut pages = 0;
            loop {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() { return Err("Время ожидания моделей Codex истекло".into()); }
                let line = match rx.recv_timeout(remaining.min(Duration::from_millis(200))) {
                    Ok(line) => line,
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if child.try_wait().map_err(|_| "Ошибка процесса Codex")?.is_some() { return Err("Codex завершился до ответа".into()); }
                        continue;
                    }
                    Err(_) => return Err("Соединение с Codex закрыто".into()),
                };
                let Ok(event) = serde_json::from_str::<Value>(&line) else { continue };
                let Some(id) = event.get("id").and_then(Value::as_u64) else { continue };
                if let Some(error) = event.get("error") {
                    let message = error.get("message").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase();
                    if message.contains("auth") || message.contains("login") || message.contains("sign in") {
                        return Err("Войдите в Codex, чтобы получить список моделей".into());
                    }
                    return Err("Codex не смог получить список моделей".into());
                }
                if id == 1 {
                    send(serde_json::json!({"method":"initialized"}))?;
                    send(serde_json::json!({"id":2,"method":"model/list","params":{"includeHidden":false}}))?;
                    continue;
                }
                if id != 2 { continue; }
                let result = event.get("result").ok_or("Codex вернул пустой ответ")?;
                let entries = result.get("data").and_then(Value::as_array).ok_or("Codex не вернул модели")?;
                for entry in entries {
                    if entry.get("hidden").and_then(Value::as_bool) == Some(true) { continue; }
                    let Some(model_id) = entry.get("model").or_else(|| entry.get("id")).and_then(Value::as_str) else { continue };
                    if ids.insert(model_id.to_owned()) {
                        if let Some(item) = model(model_id, entry.get("displayName").and_then(Value::as_str), entry.get("description").and_then(Value::as_str)) { results.push(item); }
                    }
                }
                let next = result.get("nextCursor").and_then(Value::as_str).filter(|s| !s.is_empty());
                let Some(next) = next else { return Ok(results); };
                pages += 1;
                if pages >= 50 || !cursors.insert(next.to_owned()) { return Err("Слишком много страниц моделей Codex".into()); }
                send(serde_json::json!({"id":2,"method":"model/list","params":{"cursor":next,"includeHidden":false}}))?;
            }
        })();
        let _ = child.kill();
        let _ = child.wait();
        result
    }).await.map_err(|_| "Не удалось получить модели Codex".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn endpoints_stay_on_configured_origin() {
        assert_eq!(
            endpoint("openai", Some("https://example.com/api/v1/".into()))
                .unwrap()
                .as_str(),
            "https://example.com/api/v1/models"
        );
        assert_eq!(
            endpoint("ollama", Some("http://localhost:11434/v1".into()))
                .unwrap()
                .as_str(),
            "http://localhost:11434/api/tags"
        );
        assert!(endpoint("custom", Some("https://user:secret@example.com/v1".into())).is_err());
        assert!(endpoint("custom", Some("https://example.com/v1?token=secret".into())).is_err());
    }

    #[test]
    fn gemini_pages_use_tokens_and_strip_model_prefix() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for (expected, body) in [
                (
                    "GET /v1beta/models HTTP",
                    r#"{"models":[{"name":"models/gemini-a","displayName":"Gemini A","supportedGenerationMethods":["generateContent"]},{"name":"models/embedding-only","supportedGenerationMethods":["embedContent"]}],"nextPageToken":"next token"}"#,
                ),
                (
                    "GET /v1beta/models?pageToken=next+token HTTP",
                    r#"{"models":[{"name":"models/gemini-b","description":"second page"}]}"#,
                ),
            ] {
                let (mut stream, _) = listener.accept().unwrap();
                let mut buffer = [0_u8; 4096];
                let size = stream.read(&mut buffer).unwrap();
                let request = String::from_utf8_lossy(&buffer[..size]);
                assert!(request.starts_with(expected), "unexpected request path");
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(response.as_bytes()).unwrap();
            }
        });
        let models = tauri::async_runtime::block_on(list_provider_models(
            "gemini".into(),
            "test-key".into(),
            Some(format!("http://{address}/v1beta")),
        ))
        .unwrap();
        server.join().unwrap();
        assert_eq!(
            models.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            ["gemini-a", "gemini-b"]
        );
        assert_eq!(models[0].display_name.as_deref(), Some("Gemini A"));
        assert_eq!(models[1].description.as_deref(), Some("second page"));
    }
}

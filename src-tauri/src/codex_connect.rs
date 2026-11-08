use std::{io::{BufRead, BufReader, Write}, path::PathBuf, process::{Command, Stdio}, sync::mpsc, time::{Duration, Instant}};
use serde::Serialize;
use tauri::ipc::Channel;

// GUI apps on macOS do not inherit a user's interactive shell PATH.
pub fn find_codex() -> Result<PathBuf, String> {
    let name = if cfg!(windows) { "codex.exe" } else { "codex" };
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(name);
            if candidate.is_file() { return Ok(candidate); }
            #[cfg(windows)]
            { let candidate = dir.join("codex.cmd"); if candidate.is_file() { return Ok(candidate); } }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let mut candidates = vec![PathBuf::from("/opt/homebrew/bin/codex"), PathBuf::from("/usr/local/bin/codex"), PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")];
        if let Some(home) = std::env::var_os("HOME") { candidates.insert(0, PathBuf::from(home).join(".local/bin/codex")); }
        if let Some(found) = candidates.into_iter().find(|p| p.is_file()) { return Ok(found); }
    }
    Err("Codex CLI не найден. Установите Codex CLI и попробуйте снова.".into())
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ConnectEvent { Browser { url: String }, Status { message: String } }

#[tauri::command]
pub async fn connect_codex(on_event: Channel<ConnectEvent>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let path = find_codex()?;
        let mut command = Command::new(path);
        command.args(["app-server", "--listen", "stdio://"]).current_dir(std::env::temp_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
        let mut child = command.spawn().map_err(|e| format!("Не удалось запустить Codex: {e}"))?;
        let result = (|| {
            let mut input = child.stdin.take().ok_or("Не удалось открыть ввод Codex")?;
            let output = child.stdout.take().ok_or("Не удалось открыть вывод Codex")?;
            let (tx, rx) = mpsc::channel();
            std::thread::spawn(move || { for line in BufReader::new(output).lines().map_while(Result::ok) { if tx.send(line).is_err() { break; } } });
            let send = |input: &mut std::process::ChildStdin, value: serde_json::Value| -> Result<(), String> { writeln!(input, "{value}").and_then(|_| input.flush()).map_err(|e| e.to_string()) };
            send(&mut input, serde_json::json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"interview_kit","version":"1.0.0"},"capabilities":{}}}))?;
            let deadline = Instant::now() + Duration::from_secs(300);
            let mut login_id: Option<String> = None;
            loop {
                if Instant::now() >= deadline { return Err("Время ожидания входа истекло. Попробуйте ещё раз.".into()); }
                let line = match rx.recv_timeout(Duration::from_millis(200)) {
                    Ok(line) => line,
                    Err(mpsc::RecvTimeoutError::Timeout) => { if child.try_wait().map_err(|e| e.to_string())?.is_some() { return Err("Codex завершился до окончания подключения.".into()); } continue; },
                    Err(_) => return Err("Соединение с Codex закрыто.".into()),
                };
                let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
                if let Some(error) = event.get("error") { return Err(format!("Codex: {error}")); }
                match event.get("id").and_then(|v| v.as_u64()) {
                    Some(1) => { send(&mut input, serde_json::json!({"method":"initialized"}))?; send(&mut input, serde_json::json!({"id":2,"method":"account/read","params":{"refreshToken":false}}))?; }
                    Some(2) => {
                        if !event.pointer("/result/account").unwrap_or(&serde_json::Value::Null).is_null() { return Ok(()); }
                        let _ = on_event.send(ConnectEvent::Status { message: "Откройте страницу входа и подтвердите доступ в браузере.".into() });
                        send(&mut input, serde_json::json!({"id":3,"method":"account/login/start","params":{"type":"chatgpt"}}))?;
                    }
                    Some(3) => {
                        login_id = event.pointer("/result/loginId").and_then(|v| v.as_str()).map(str::to_owned);
                        let url = event.pointer("/result/authUrl").and_then(|v| v.as_str()).ok_or("Codex не вернул ссылку для входа")?;
                        let parsed = reqwest::Url::parse(url).map_err(|_| "Codex вернул неверную ссылку для входа")?;
                        if parsed.scheme() != "https" || !matches!(parsed.host_str(), Some("auth.openai.com" | "chatgpt.com")) { return Err("Codex вернул неожиданный адрес входа".into()); }
                        on_event.send(ConnectEvent::Browser { url: url.to_string() }).map_err(|e| e.to_string())?;
                    }
                    _ => {}
                }
                if event.get("method").and_then(|v| v.as_str()) == Some("account/login/completed") && event.pointer("/params/loginId").and_then(|v| v.as_str()) == login_id.as_deref() && login_id.is_some() {
                    return if event.pointer("/params/success").and_then(|v| v.as_bool()) == Some(true) { Ok(()) } else { Err(format!("Вход в Codex не завершён: {}", event.pointer("/params/error").and_then(|v| v.as_str()).unwrap_or("неизвестная ошибка"))) };
                }
            }
        })();
        let _ = child.kill(); let _ = child.wait(); result
    }).await.map_err(|e| e.to_string())?
}

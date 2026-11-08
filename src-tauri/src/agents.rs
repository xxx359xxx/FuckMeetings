use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AgentEvent {
    Stdout { line: String },
    Stderr { line: String },
    Exit { code: Option<i32> },
    Error { message: String },
}

#[tauri::command]
pub async fn run_agent(
    kind: String,
    prompt: String,
    command: Option<String>,
    workdir: Option<String>,
    on_event: Channel<AgentEvent>,
) -> Result<(), String> {
    let default_cmd = match kind.as_str() {
        "claude" => "claude -p {prompt}".to_string(),
        "codex" => "codex exec --skip-git-repo-check {prompt}".to_string(),
        other => return Err(format!("Неизвестный агент: {other}")),
    };

    let template = command.unwrap_or(default_cmd);
    let final_cmd = if template.contains("{prompt}") {
        template.replace("{prompt}", "-")
    } else {
        format!("{template} -")
    };

    let wd = workdir.unwrap_or_else(|| std::env::temp_dir().to_string_lossy().to_string());

    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = if cfg!(windows) {
            let mut c = Command::new("cmd");
            c.args(["/C", &final_cmd]);
            c
        } else {
            let mut c = Command::new("sh");
            c.args(["-c", &final_cmd]);
            c
        };

        cmd.current_dir(&wd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = on_event.send(AgentEvent::Error {
                    message: format!(
                        "Не удалось запустить агент: {e}. Проверьте, что CLI установлен и команда в настройках верна."
                    ),
                });
                return;
            }
        };

        if let Some(mut stdin) = child.stdin.take() {
            if let Err(e) = stdin.write_all(prompt.as_bytes()) {
                let _ = on_event.send(AgentEvent::Error { message: format!("Ошибка передачи запроса агенту: {e}") });
                let _ = child.kill(); let _ = child.wait(); return;
            }
        }
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let ev1 = on_event.clone();
        let h1 = std::thread::spawn(move || {
            if let Some(out) = stdout {
                for line in BufReader::new(out).lines().filter_map(|l| l.ok()) {
                    let _ = ev1.send(AgentEvent::Stdout { line });
                }
            }
        });

        let ev2 = on_event.clone();
        let h2 = std::thread::spawn(move || {
            if let Some(err) = stderr {
                for line in BufReader::new(err).lines().filter_map(|l| l.ok()) {
                    let _ = ev2.send(AgentEvent::Stderr { line });
                }
            }
        });

        let _ = h1.join();
        let _ = h2.join();

        match child.wait() {
            Ok(status) => {
                let _ = on_event.send(AgentEvent::Exit { code: status.code() });
            }
            Err(e) => {
                let _ = on_event.send(AgentEvent::Error {
                    message: e.to_string(),
                });
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

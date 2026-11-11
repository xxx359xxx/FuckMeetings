use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::ipc::Channel;

static RUNNING_AGENTS: OnceLock<Mutex<Vec<u32>>> = OnceLock::new();

fn running_agents() -> &'static Mutex<Vec<u32>> {
    RUNNING_AGENTS.get_or_init(|| Mutex::new(Vec::new()))
}

struct AgentProcessGuard(u32);

impl Drop for AgentProcessGuard {
    fn drop(&mut self) {
        if let Ok(mut agents) = running_agents().lock() {
            agents.retain(|pid| *pid != self.0);
        }
    }
}

pub fn terminate_running_agents() {
    let Ok(mut registry) = running_agents().lock() else { return };
    let pids = std::mem::take(&mut *registry);
    drop(registry);
    for pid in pids {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .creation_flags(0x08000000)
                .status();
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill").args(["-TERM", &pid.to_string()]).status();
        }
    }
}

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
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

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
        let pid = child.id();
        if let Ok(mut agents) = running_agents().lock() {
            agents.push(pid);
        }
        let _guard = AgentProcessGuard(pid);

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

        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
                Err(_) => break,
            }
            // Stop both the shell and its descendants if the primary window closed.
            #[cfg(windows)]
            if !running_agents().lock().map(|agents| agents.contains(&pid)).unwrap_or(false) {
                use std::os::windows::process::CommandExt;
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/T", "/F"])
                    .creation_flags(0x08000000)
                    .status();
                break;
            }
            #[cfg(not(windows))]
            if !running_agents().lock().map(|agents| agents.contains(&pid)).unwrap_or(false) {
                let _ = child.kill();
                break;
            }
        }

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

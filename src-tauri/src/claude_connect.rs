use std::{path::PathBuf, process::Command};

// A packaged GUI does not receive the PATH from an interactive shell.
pub fn find_claude() -> Result<PathBuf, String> {
    let name = if cfg!(windows) { "claude.exe" } else { "claude" };
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(name);
            if candidate.is_file() { return Ok(candidate); }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let mut candidates = vec![PathBuf::from("/opt/homebrew/bin/claude"), PathBuf::from("/usr/local/bin/claude")];
        if let Some(home) = std::env::var_os("HOME") {
            candidates.insert(0, PathBuf::from(&home).join(".local/bin/claude"));
            candidates.insert(1, PathBuf::from(home).join(".claude/local/claude"));
        }
        if let Some(found) = candidates.into_iter().find(|p| p.is_file()) { return Ok(found); }
    }
    Err("Claude Code CLI не найден. Установите официальный Claude Code (на Windows требуется claude.exe) и попробуйте снова.".into())
}

#[tauri::command]
pub async fn connect_claude() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut command = Command::new(find_claude()?);
        command.args(["auth", "status"])
            .current_dir(std::env::temp_dir())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
        let status = command.status().map_err(|e| format!("Не удалось проверить Claude Code: {e}"))?;
        if status.success() { Ok(()) }
        else { Err("Claude Code не авторизован. Выполните `claude auth login` в терминале и повторите проверку.".into()) }
    }).await.map_err(|e| e.to_string())?
}

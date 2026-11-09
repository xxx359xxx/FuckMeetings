//! Copy data left under the previous Tauri identifier before the UI loads its store.
//! The old tree is intentionally retained so interrupted runs can be retried.

use std::{fs, io, path::{Path, PathBuf}};
use tauri::Manager;

const OLD_ID: &str = "com.interviewkit.desktop";
const NEW_ID: &str = "com.den4iksoftware.fuckmeetings";
const MARKER: &str = ".interviewkit-identifier-migrated";

pub fn migrate(app: &tauri::AppHandle) -> tauri::Result<()> {
    if app.config().identifier != NEW_ID {
        return Ok(());
    }
    let new_data = app.path().app_data_dir()?;
    let new_local = app.path().app_local_data_dir()?;
    let old_data = old_sibling(&new_data).map_err(tauri::Error::Io)?;
    let old_local = old_sibling(&new_local).map_err(tauri::Error::Io)?;
    let resources = app.path().resource_dir().ok();

    migrate_paths(&old_data, &new_data, &old_local, &new_local, resources.as_deref())
        .map_err(tauri::Error::Io)?;
    Ok(())
}

fn migrate_paths(old_data: &Path, new_data: &Path, old_local: &Path, new_local: &Path,
                 resources: Option<&Path>) -> io::Result<()> {
    // A completed migration must never resurrect a file the user later removed.
    let marker = new_data.join(MARKER);
    if fs::symlink_metadata(&marker).is_ok() { return Ok(()); }
    let has_old_data = fs::symlink_metadata(old_data).is_ok();
    let has_old_local = fs::symlink_metadata(old_local).is_ok();
    if !has_old_data && !has_old_local { return Ok(()); }
    if old_local != old_data || new_local != new_data {
        migrate_dir(old_local, new_local, None)?;
    }
    migrate_dir(old_data, new_data, Some((old_local, new_local, resources)))?;
    if !new_data.exists() { create_private_dir(new_data)?; }
    let file = fs::OpenOptions::new().write(true).create_new(true).open(marker)?;
    file.sync_all()
}

fn old_sibling(new: &Path) -> io::Result<PathBuf> {
    if new.file_name().is_none_or(|name| name != NEW_ID) {
        return Err(io::Error::other(format!("unexpected app directory: {}", new.display())));
    }
    Ok(new.with_file_name(OLD_ID))
}

type SettingsPaths<'a> = (&'a Path, &'a Path, Option<&'a Path>);

fn migrate_dir(old: &Path, new: &Path, settings: Option<SettingsPaths<'_>>) -> io::Result<()> {
    match fs::symlink_metadata(old) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
        Ok(meta) if !meta.is_dir() => return Err(io::Error::other("legacy app directory is not a directory")),
        Ok(_) => {}
    }
    copy_tree(old, new, settings, true)
}

fn copy_tree(old: &Path, new: &Path, settings: Option<SettingsPaths<'_>>, root: bool) -> io::Result<()> {
    let created = match fs::symlink_metadata(new) {
        Ok(meta) if !meta.is_dir() => return Err(io::Error::other(format!("destination is not a directory: {}", new.display()))),
        Ok(_) => false,
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            create_private_dir(new)?;
            true
        }
        Err(e) => return Err(e),
    };
    let mut settings_file = None;
    for entry in fs::read_dir(old)? {
        let entry = entry?;
        let source = entry.path();
        let target = new.join(entry.file_name());
        let meta = fs::symlink_metadata(&source)?;
        if root && entry.file_name() == "settings.json" && settings.is_some() && meta.is_file() {
            settings_file = Some((source, target));
        } else if meta.is_dir() {
            copy_tree(&source, &target, None, false)?;
        } else if meta.is_file() {
            copy_file(&source, &target, None)?;
        } else if meta.file_type().is_symlink() {
            copy_symlink(&source, &target)?;
        } else {
            return Err(io::Error::other(format!("unsupported legacy file: {}", source.display())));
        }
    }
    if let (Some((source, target)), Some((old_local, new_local, resources))) = (settings_file, settings) {
        copy_settings(&source, &target, old, new, old_local, new_local, resources)?;
    }
    if created { fs::set_permissions(new, fs::metadata(old)?.permissions())?; }
    Ok(())
}

fn create_private_dir(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = fs::DirBuilder::new();
        builder.mode(0o700).create(path)
    }
    #[cfg(windows)]
    { fs::create_dir(path) }
}

fn copy_file(source: &Path, target: &Path, contents: Option<&[u8]>) -> io::Result<()> {
    // A temporary file in the destination directory plus persist_noclobber keeps
    // interrupted copies and a concurrent new-app write from replacing a good file.
    if fs::symlink_metadata(target).is_ok() { return Ok(()); }
    let parent = target.parent().ok_or_else(|| io::Error::other("destination has no parent"))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    if let Some(bytes) = contents {
        io::Write::write_all(&mut temporary, bytes)?;
    } else {
        let mut input = fs::File::open(source)?;
        io::copy(&mut input, &mut temporary)?;
    }
    temporary.as_file().set_permissions(fs::metadata(source)?.permissions())?;
    temporary.as_file().sync_all()?;
    match temporary.persist_noclobber(target) {
        Ok(_) => Ok(()),
        Err(e) if e.error.kind() == io::ErrorKind::AlreadyExists => Ok(()),
        Err(e) => Err(e.error),
    }
}

fn copy_settings(source: &Path, target: &Path, old_data: &Path, new_data: &Path,
                 old_local: &Path, new_local: &Path, resources: Option<&Path>) -> io::Result<()> {
    if fs::symlink_metadata(target).is_ok() { return Ok(()); }
    let original = fs::read(source)?;
    let rewritten = match serde_json::from_slice::<serde_json::Value>(&original) {
        Ok(mut document) => {
            if let Some(settings) = document.get_mut("settings") {
                for key in ["whisperExecutable", "whisperModelPath"] {
                    if let Some(value) = settings.get_mut(key) {
                        if let Some(path) = value.as_str() {
                            if let Some(path) = rewrite_path(path, old_data, new_data, old_local, new_local, resources) {
                                *value = serde_json::Value::String(path);
                            }
                        }
                    }
                }
            }
            serde_json::to_vec(&document).map_err(io::Error::other)?
        }
        // An unreadable legacy store is still copied intact for manual recovery.
        Err(_) => original,
    };
    copy_file(source, target, Some(&rewritten))
}

fn rewrite_path(value: &str, old_data: &Path, new_data: &Path, old_local: &Path,
                new_local: &Path, resources: Option<&Path>) -> Option<String> {
    let path = Path::new(value);
    for (old, new) in [(old_local, new_local), (old_data, new_data)] {
        if let Ok(relative) = path.strip_prefix(old) {
            let target = new.join(relative);
            if target.is_file() { return Some(target.to_string_lossy().into_owned()); }
        }
    }
    // Apple Silicon ships whisper-cli inside the app bundle, outside app data.
    // Only replace the known bundled executable when it exists in the new bundle.
    if cfg!(target_os = "macos") && path.file_name().is_some_and(|n| n == "whisper-cli")
        && path.parent().and_then(Path::file_name).is_some_and(|n| n == "whisper")
        && value.contains("/Contents/Resources/whisper/") {
        if let Some(target) = resources.map(|r| r.join("whisper").join("whisper-cli")) {
            if target.is_file() { return Some(target.to_string_lossy().into_owned()); }
        }
    }
    None
}

#[cfg(unix)]
fn copy_symlink(source: &Path, target: &Path) -> io::Result<()> {
    if fs::symlink_metadata(target).is_ok() { return Ok(()); }
    std::os::unix::fs::symlink(fs::read_link(source)?, target)
}

#[cfg(windows)]
fn copy_symlink(source: &Path, target: &Path) -> io::Result<()> {
    if fs::symlink_metadata(target).is_ok() { return Ok(()); }
    let destination = fs::read_link(source)?;
    if fs::metadata(source).is_ok_and(|m| m.is_dir()) {
        std::os::windows::fs::symlink_dir(destination, target)
    } else {
        std::os::windows::fs::symlink_file(destination, target)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_without_replacing_and_rewrites_managed_paths() {
        let tmp = tempfile::tempdir().unwrap();
        let old_data = tmp.path().join("old-data");
        let new_data = tmp.path().join("new-data");
        let old_local = tmp.path().join("old-local");
        let new_local = tmp.path().join("new-local");
        fs::create_dir_all(old_data.join("docs")).unwrap();
        fs::create_dir_all(old_local.join("whisper")).unwrap();
        fs::write(old_data.join("docs/notes.txt"), "original").unwrap();
        fs::write(old_local.join("whisper/model.bin"), "model").unwrap();
        fs::write(old_local.join("whisper/whisper-cli.exe"), "engine").unwrap();
        fs::write(old_data.join("settings.json"), serde_json::to_vec(&serde_json::json!({
            "settings": {
                "whisperExecutable": old_local.join("whisper/whisper-cli.exe"),
                "whisperModelPath": old_local.join("whisper/model.bin"),
                "other": "retained"
            }
        })).unwrap()).unwrap();
        migrate_dir(&old_local, &new_local, None).unwrap();
        migrate_dir(&old_data, &new_data, Some((&old_local, &new_local, None))).unwrap();
        let settings: serde_json::Value = serde_json::from_slice(&fs::read(new_data.join("settings.json")).unwrap()).unwrap();
        assert_eq!(settings["settings"]["whisperModelPath"], new_local.join("whisper/model.bin").to_string_lossy().as_ref());
        assert_eq!(settings["settings"]["whisperExecutable"], new_local.join("whisper/whisper-cli.exe").to_string_lossy().as_ref());
        assert_eq!(settings["settings"]["other"], "retained");
        assert_eq!(fs::read(old_data.join("docs/notes.txt")).unwrap(), b"original");
        fs::write(new_data.join("docs/notes.txt"), "newer").unwrap();
        migrate_dir(&old_data, &new_data, Some((&old_local, &new_local, None))).unwrap();
        assert_eq!(fs::read(new_data.join("docs/notes.txt")).unwrap(), b"newer");
    }

    #[test]
    fn completed_migration_does_not_restore_deleted_files() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("old");
        let new = tmp.path().join("new");
        fs::create_dir(&old).unwrap();
        fs::write(old.join("delete-me.txt"), "legacy").unwrap();
        migrate_paths(&old, &new, &old, &new, None).unwrap();
        assert!(new.join(MARKER).is_file());
        fs::remove_file(new.join("delete-me.txt")).unwrap();
        migrate_paths(&old, &new, &old, &new, None).unwrap();
        assert!(!new.join("delete-me.txt").exists());
        assert!(old.join("delete-me.txt").is_file());
    }

    #[test]
    fn shared_data_and_local_directory_rewrites_after_model_copy() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("old");
        let new = tmp.path().join("new");
        fs::create_dir_all(old.join("whisper")).unwrap();
        fs::write(old.join("whisper/model.bin"), "model").unwrap();
        fs::write(old.join("settings.json"), serde_json::to_vec(&serde_json::json!({
            "settings": { "whisperModelPath": old.join("whisper/model.bin") }
        })).unwrap()).unwrap();
        migrate_paths(&old, &new, &old, &new, None).unwrap();
        let settings: serde_json::Value = serde_json::from_slice(&fs::read(new.join("settings.json")).unwrap()).unwrap();
        assert_eq!(settings["settings"]["whisperModelPath"], new.join("whisper/model.bin").to_string_lossy().as_ref());
    }

    #[test]
    fn keeps_external_paths_and_malformed_store_bytes() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("old");
        let new = tmp.path().join("new");
        fs::create_dir(&old).unwrap();
        fs::write(old.join("settings.json"), b"{broken").unwrap();
        migrate_dir(&old, &new, Some((&old, &new, None))).unwrap();
        assert_eq!(fs::read(new.join("settings.json")).unwrap(), b"{broken");
        assert!(rewrite_path("/external/custom/model.bin", &old, &new, &old, &new, None).is_none());
    }
}

use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{io::{Read, Write}, path::{Path, PathBuf}};
use tauri::{ipc::Channel, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress { stage: String, downloaded: u64, total: u64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModel { executable: String, model_path: String }

const MODEL_IDS: &[&str] = &["base", "base-q5_1", "base-q8_0", "base.en", "base.en-q5_1", "base.en-q8_0", "large-v1", "large-v2", "large-v2-q5_0", "large-v2-q8_0", "large-v3", "large-v3-q5_0", "large-v3-turbo", "large-v3-turbo-q5_0", "large-v3-turbo-q8_0", "medium", "medium-q5_0", "medium-q8_0", "medium.en", "medium.en-q5_0", "medium.en-q8_0", "small", "small-q5_1", "small-q8_0", "small.en", "small.en-q5_1", "small.en-q8_0", "tiny", "tiny-q5_1", "tiny-q8_0", "tiny.en", "tiny.en-q5_1", "tiny.en-q8_0"];

fn model_info(id: &str) -> Option<(&'static str, u64, &'static str)> {
    match id {
        "tiny" => Some(("ggml-tiny.bin", 77691713, "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21")),
        "base" => Some(("ggml-base.bin", 147951465, "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe")),
        "small" => Some(("ggml-small.bin", 487601967, "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b")),
        "tiny.en" => Some(("ggml-tiny.en.bin", 77704715, "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f")),
        "base.en" => Some(("ggml-base.en.bin", 147964211, "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002")),
        "small.en" => Some(("ggml-small.en.bin", 487614201, "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d")),
        "small-q5_1" => Some(("ggml-small-q5_1.bin", 190085487, "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb")),
        "small.en-q5_1" => Some(("ggml-small.en-q5_1.bin", 190098681, "bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30")),
        "medium-q5_0" => Some(("ggml-medium-q5_0.bin", 539212467, "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f")),
        "medium.en-q5_0" => Some(("ggml-medium.en-q5_0.bin", 539225533, "76733e26ad8fe1c7a5bf7531a9d41917b2adc0f20f2e4f5531688a8c6cd88eb0")),
        "large-v3-turbo-q5_0" => Some(("ggml-large-v3-turbo-q5_0.bin", 574041195, "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2")),
        "base-q5_1" => Some(("ggml-base-q5_1.bin", 59707625, "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898")),
        "base-q8_0" => Some(("ggml-base-q8_0.bin", 81768585, "c577b9a86e7e048a0b7eada054f4dd79a56bbfa911fbdacf900ac5b567cbb7d9")),
        "base.en-q5_1" => Some(("ggml-base.en-q5_1.bin", 59721011, "4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f")),
        "base.en-q8_0" => Some(("ggml-base.en-q8_0.bin", 81781811, "a4d4a0768075e13cfd7e19df3ae2dbc4a68d37d36a7dad45e8410c9a34f8c87e")),
        "large-v1" => Some(("ggml-large-v1.bin", 3094623691, "7d99f41a10525d0206bddadd86760181fa920438b6b33237e3118ff6c83bb53d")),
        "large-v2-q5_0" => Some(("ggml-large-v2-q5_0.bin", 1080732091, "3a214837221e4530dbc1fe8d734f302af393eb30bd0ed046042ebf4baf70f6f2")),
        "large-v2-q8_0" => Some(("ggml-large-v2-q8_0.bin", 1656129691, "fef54e6d898246a65c8285bfa83bd1807e27fadf54d5d4e81754c47634737e8c")),
        "large-v2" => Some(("ggml-large-v2.bin", 3094623691, "9a423fe4d40c82774b6af34115b8b935f34152246eb19e80e376071d3f999487")),
        "large-v3-q5_0" => Some(("ggml-large-v3-q5_0.bin", 1081140203, "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1")),
        "large-v3-turbo-q8_0" => Some(("ggml-large-v3-turbo-q8_0.bin", 874188075, "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1")),
        "large-v3-turbo" => Some(("ggml-large-v3-turbo.bin", 1624555275, "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69")),
        "large-v3" => Some(("ggml-large-v3.bin", 3095033483, "64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2")),
        "medium-q8_0" => Some(("ggml-medium-q8_0.bin", 823369779, "42a1ffcbe4167d224232443396968db4d02d4e8e87e213d3ee2e03095dea6502")),
        "medium" => Some(("ggml-medium.bin", 1533763059, "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208")),
        "medium.en-q8_0" => Some(("ggml-medium.en-q8_0.bin", 823382461, "43fa2cd084de5a04399a896a9a7a786064e221365c01700cea4666005218f11c")),
        "medium.en" => Some(("ggml-medium.en.bin", 1533774781, "cc37e93478338ec7700281a7ac30a10128929eb8f427dda2e865faa8f6da4356")),
        "small-q8_0" => Some(("ggml-small-q8_0.bin", 264464607, "49c8fb02b65e6049d5fa6c04f81f53b867b5ec9540406812c643f177317f779f")),
        "small.en-q8_0" => Some(("ggml-small.en-q8_0.bin", 264477561, "67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067")),
        "tiny-q5_1" => Some(("ggml-tiny-q5_1.bin", 32152673, "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7")),
        "tiny-q8_0" => Some(("ggml-tiny-q8_0.bin", 43537433, "c2085835d3f50733e2ff6e4b41ae8a2b8d8110461e18821b09a15c40c42d1cca")),
        "tiny.en-q5_1" => Some(("ggml-tiny.en-q5_1.bin", 32166155, "c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b")),
        "tiny.en-q8_0" => Some(("ggml-tiny.en-q8_0.bin", 43550795, "5bc2b3860aa151a4c6e7bb095e1fcce7cf12c7b020ca08dcec0c6d018bb7dd94")),
        _ => None,
    }
}
fn valid(path: &Path, size: u64, expected: &str) -> bool {
    let Ok(mut f) = std::fs::File::open(path) else { return false };
    if f.metadata().map(|m| m.len()).unwrap_or(0) != size { return false; }
    let mut h = Sha256::new(); let mut b = [0u8; 65536];
    loop { match f.read(&mut b) { Ok(0) => break, Ok(n) => h.update(&b[..n]), Err(_) => return false } }
    format!("{:x}", h.finalize()) == expected
}
async fn download(url: &str, path: &Path, size: u64, hash: &str, stage: &str, progress: &Channel<InstallProgress>) -> Result<(), String> {
    if valid(path, size, hash) { let _ = progress.send(InstallProgress { stage: stage.into(), downloaded:size, total:size }); return Ok(()); }
    let tmp = path.with_extension("partial");
    let result = async {
        let response = reqwest::Client::new().get(url).header("User-Agent", "FuckMeetings").send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
        let mut stream = response.bytes_stream(); let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?; let mut h = Sha256::new(); let mut n = 0u64;
        while let Some(chunk) = stream.next().await { let chunk = chunk.map_err(|e| e.to_string())?; n += chunk.len() as u64; if n > size { return Err("Размер файла превышает ожидаемый".into()); } file.write_all(&chunk).map_err(|e| e.to_string())?; h.update(&chunk); let _ = progress.send(InstallProgress { stage: stage.into(), downloaded:n, total:size }); }
        file.sync_all().map_err(|e| e.to_string())?; drop(file);
        if n != size || format!("{:x}", h.finalize()) != hash { return Err("Загруженный файл не прошёл проверку целостности".into()); }
        if path.exists() { std::fs::remove_file(path).map_err(|e| e.to_string())?; }
        std::fs::rename(&tmp, path).map_err(|e| e.to_string())?; Ok(())
    }.await;
    if result.is_err() { let _ = std::fs::remove_file(tmp); } result
}
#[tauri::command]
pub async fn install_local_model(app: tauri::AppHandle, model: String, on_progress: Channel<InstallProgress>) -> Result<InstalledModel, String> {
    if !cfg!(any(all(target_os = "windows", target_arch = "x86_64"), all(target_os = "macos", target_arch = "aarch64"))) { return Err("Автоматическая установка доступна для Windows x64 и Mac с Apple Silicon".into()); }
    let (filename, size, sha) = model_info(&model).ok_or("Неизвестная модель")?;
    let root: PathBuf = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("whisper");
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let exe = bundled_engine(&app)?;
    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    let exe = {
    let archive = root.join("whisper-b5454.zip");
    download("https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip", &archive, 8928640, "6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb", "engine", &on_progress).await?;
    let engine = root.join("engine-b5454"); std::fs::create_dir_all(&engine).map_err(|e| e.to_string())?;
    let exe = engine.join("Release").join("whisper-cli.exe");
    if !exe.is_file() {
    let mut zip = zip::ZipArchive::new(std::fs::File::open(&archive).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    for i in 0..zip.len() { let mut entry = zip.by_index(i).map_err(|e| e.to_string())?; let Some(name) = entry.enclosed_name().map(|p| p.to_owned()) else { return Err("Недопустимый путь в архиве движка".into()); }; let dest = engine.join(name); if entry.is_dir() { std::fs::create_dir_all(dest).map_err(|e| e.to_string())?; } else { if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; } let mut f = std::fs::File::create(dest).map_err(|e| e.to_string())?; std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?; } }

    }
    if !exe.is_file() { return Err("В архиве не найден whisper-cli.exe".into()); }
    exe
    };
    let model_path = root.join(filename);
    download(&format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{filename}"), &model_path, size, sha, "model", &on_progress).await?;
    Ok(InstalledModel { executable: exe.to_string_lossy().into_owned(), model_path: model_path.to_string_lossy().into_owned() })
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn bundled_engine(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let exe = app.path().resource_dir().map_err(|e| e.to_string())?.join("whisper").join("whisper-cli");
    if !exe.is_file() { return Err("Движок whisper.cpp не найден в приложении. Переустановите приложение из DMG.".into()); }
    Ok(exe)
}

#[tauri::command]
pub fn delete_local_model(app: tauri::AppHandle, model_path: String) -> Result<(), String> {
    let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("whisper");
    let path = PathBuf::from(model_path);
    let name = path.file_name().and_then(|s| s.to_str()).ok_or("Неверный путь модели")?;
    if !MODEL_IDS.iter().any(|id| model_info(id).map(|x| x.0 == name).unwrap_or(false)) { return Err("Эта модель не управляется приложением".into()); }
    let canonical_root = root.canonicalize().map_err(|e| e.to_string())?;
    let canonical_path = path.canonicalize().map_err(|e| e.to_string())?;
    if canonical_path.parent() != Some(canonical_root.as_path()) { return Err("Модель находится вне папки приложения".into()); }
    std::fs::remove_file(canonical_path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelInfo { id: String, model_path: String, size: u64, complete: bool }
#[tauri::command]
pub fn list_local_models(app: tauri::AppHandle) -> Result<Vec<LocalModelInfo>, String> {
    let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("whisper");
    let mut models = Vec::new();
    for id in MODEL_IDS {
        let (filename, expected_size, _) = model_info(id).ok_or("Неизвестная модель")?;
        let path = root.join(filename);
        if let Ok(meta) = std::fs::metadata(&path) { if meta.is_file() { models.push(LocalModelInfo { id: (*id).into(), model_path: path.to_string_lossy().into_owned(), size: meta.len(), complete: meta.len() == expected_size }); } }
    }
    Ok(models)
}
#[tauri::command]
pub async fn activate_local_model(app: tauri::AppHandle, model: String) -> Result<InstalledModel, String> {
    let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("whisper");
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let bundled = bundled_engine(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (filename, size, hash) = model_info(&model).ok_or("Неизвестная модель")?;
        let path = root.join(filename);
        if !valid(&path, size, hash) { return Err("Файл модели отсутствует или повреждён. Скачайте его снова.".into()); }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        let exe = bundled;
        #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
        let exe = root.join("engine-b5454").join("Release").join("whisper-cli.exe");
        if !exe.is_file() { return Err("Движок распознавания не найден. Нажмите «Скачать и применить», чтобы восстановить его.".into()); }
        Ok(InstalledModel { executable: exe.to_string_lossy().into_owned(), model_path: path.to_string_lossy().into_owned() })
    }).await.map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn verifies_model_file_and_rejects_damage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.bin");
        std::fs::write(&path, b"abc").unwrap();
        let hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert!(valid(&path, 3, hash));
        assert!(!valid(&path, 4, hash));
        std::fs::write(&path, b"xyz").unwrap();
        assert!(!valid(&path, 3, hash));
    }
    #[test]
    fn catalog_ids_are_known_and_filenames_unique() {
        let mut filenames = std::collections::HashSet::new();
        for id in MODEL_IDS { let (name, size, hash) = model_info(id).unwrap(); assert!(filenames.insert(name)); assert!(size > 0); assert_eq!(hash.len(), 64); }
        assert!(model_info("../../outside").is_none());
    }
}

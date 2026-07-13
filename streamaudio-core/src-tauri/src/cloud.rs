use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Manager};
use notify::{Watcher, RecursiveMode, EventKind};
use keyring::Entry;

fn get_app_dir(app_handle: &AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("AppData/Local/StreamAudioCore"))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CommunityPack {
    pub id: String,
    pub title: String,
    pub description: String,
    pub rating: f32,
    pub download_url: String,
    pub size: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncReport {
    pub status: String,
    pub files_synced: usize,
    pub message: String,
}

#[allow(dead_code)]
pub trait CloudProvider {
    fn upload(&self, local_path: &Path, remote_path: &str) -> Result<(), String>;
    fn download(&self, remote_path: &str, local_path: &Path) -> Result<(), String>;
    fn delete(&self, remote_path: &str) -> Result<(), String>;
    fn list_files(&self, folder: &str) -> Result<Vec<String>, String>;
}

pub struct DropboxProvider {
    pub token: String,
}

#[allow(dead_code)]
impl CloudProvider for DropboxProvider {
    fn upload(&self, local_path: &Path, remote_path: &str) -> Result<(), String> {
        let file_content = fs::read(local_path).map_err(|e| e.to_string())?;
        let client = reqwest::blocking::Client::new();
        
        let api_arg = serde_json::json!({
            "path": remote_path,
            "mode": "overwrite",
            "autorename": true,
            "mute": false,
            "strict_conflict": false
        });

        let res = client.post("https://content.dropboxapi.com/2/files/upload")
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Dropbox-API-Arg", serde_json::to_string(&api_arg).unwrap())
            .header("Content-Type", "application/octet-stream")
            .body(file_content)
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !res.status().is_success() {
            let err_text = res.text().unwrap_or_default();
            return Err(format!("Dropbox upload failed: {}", err_text));
        }

        Ok(())
    }

    fn download(&self, remote_path: &str, local_path: &Path) -> Result<(), String> {
        let client = reqwest::blocking::Client::new();
        
        let api_arg = serde_json::json!({
            "path": remote_path
        });

        let res = client.post("https://content.dropboxapi.com/2/files/download")
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Dropbox-API-Arg", serde_json::to_string(&api_arg).unwrap())
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !res.status().is_success() {
            let err_text = res.text().unwrap_or_default();
            return Err(format!("Dropbox download failed: {}", err_text));
        }

        let bytes = res.bytes().map_err(|e| e.to_string())?;
        fs::write(local_path, bytes).map_err(|e| e.to_string())?;

        Ok(())
    }

    fn delete(&self, remote_path: &str) -> Result<(), String> {
        let client = reqwest::blocking::Client::new();
        
        let body = serde_json::json!({
            "path": remote_path
        });

        let res = client.post("https://api.dropboxapi.com/2/files/delete_v2")
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !res.status().is_success() {
            let err_text = res.text().unwrap_or_default();
            return Err(format!("Dropbox delete failed: {}", err_text));
        }

        Ok(())
    }

    fn list_files(&self, folder: &str) -> Result<Vec<String>, String> {
        let client = reqwest::blocking::Client::new();
        
        let body = serde_json::json!({
            "path": folder,
            "recursive": false,
            "include_media_info": false,
            "include_deleted": false,
            "include_has_explicit_shared_members": false,
            "include_mounted_folders": true,
            "include_non_downloadable_files": true
        });

        let adjusted_path = if folder == "/" || folder.is_empty() { "" } else { folder };
        let mut final_body = body.clone();
        final_body["path"] = serde_json::json!(adjusted_path);

        let res = client.post("https://api.dropboxapi.com/2/files/list_folder")
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Content-Type", "application/json")
            .json(&final_body)
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !res.status().is_success() {
            let err_text = res.text().unwrap_or_default();
            return Err(format!("Dropbox list_folder failed: {}", err_text));
        }

        let json: serde_json::Value = res.json().map_err(|e| e.to_string())?;
        let mut files = Vec::new();
        if let Some(entries) = json["entries"].as_array() {
            for entry in entries {
                if let Some(path) = entry["path_display"].as_str() {
                    files.push(path.to_string());
                }
            }
        }
        Ok(files)
    }
}

pub struct CloudSyncManager {
    watcher: Option<notify::RecommendedWatcher>,
}

impl CloudSyncManager {
    pub fn new() -> Self {
        CloudSyncManager { watcher: None }
    }

    pub fn start_watching(&mut self, app_handle: AppHandle) -> Result<(), String> {
        let handle_clone = app_handle.clone();
        let app_dir = get_app_dir(&app_handle);
        let sounds_dir = app_dir.join("sounds");

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = notify::RecommendedWatcher::new(tx, notify::Config::default())
            .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&sounds_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch sounds folder: {}", e))?;

        self.watcher = Some(watcher);

        // Spawn folder watcher listener thread
        thread::spawn(move || {
            for res in rx {
                match res {
                    Ok(event) => {
                        if let EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) = event.kind {
                            println!("Library folder changed! Event: {:?}", event);
                            let _ = cloud_sync_now(handle_clone.clone());
                        }
                    }
                    Err(e) => eprintln!("Watcher error: {:?}", e),
                }
            }
        });

        Ok(())
    }
}

fn get_stored_token(provider: &str) -> Option<String> {
    let service = format!("StreamAudioCore_{}", provider);
    let entry = Entry::new(&service, "oauth_token").ok()?;
    entry.get_password().ok()
}

fn set_stored_token(provider: &str, token: &str) -> Result<(), String> {
    let service = format!("StreamAudioCore_{}", provider);
    let entry = Entry::new(&service, "oauth_token")
        .map_err(|e| format!("Keyring init error: {}", e))?;
    entry.set_password(token)
        .map_err(|e| format!("Keyring save error: {}", e))?;
    Ok(())
}

fn get_stored_refresh_token(provider: &str) -> Option<String> {
    let service = format!("StreamAudioCore_{}_refresh", provider);
    let entry = Entry::new(&service, "refresh_token").ok()?;
    entry.get_password().ok()
}

fn set_stored_refresh_token(provider: &str, token: &str) -> Result<(), String> {
    let service = format!("StreamAudioCore_{}_refresh", provider);
    let entry = Entry::new(&service, "refresh_token")
        .map_err(|e| format!("Keyring init error: {}", e))?;
    entry.set_password(token)
        .map_err(|e| format!("Keyring save error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn generate_auth_url() -> Result<String, String> {
    // Standard public Client ID for StreamAudio Core
    let client_id = "streamaudiocore";
    let url = format!(
        "https://www.dropbox.com/oauth2/authorize?client_id={}&response_type=code&token_access_type=offline",
        client_id
    );
    Ok(url)
}

#[tauri::command]
pub async fn exchange_code(code: String, app_handle: AppHandle) -> Result<String, String> {
    let client = reqwest::Client::new();
    let client_id = "streamaudiocore";

    let params = [
        ("code", code.as_str()),
        ("grant_type", "authorization_code"),
        ("client_id", client_id),
    ];

    let res = client.post("https://api.dropbox.com/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Dropbox connection failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Dropbox OAuth code exchange failed: {}", err_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let access_token = json["access_token"].as_str().ok_or("Dropbox returned no access token")?;
    let refresh_token = json["refresh_token"].as_str().unwrap_or("");

    set_stored_token("dropbox", access_token)?;
    if !refresh_token.is_empty() {
        set_stored_refresh_token("dropbox", refresh_token)?;
    }

    // Update config provider setting
    let config_state = app_handle.state::<Mutex<crate::config::Config>>();
    let mut config = config_state.lock().map_err(|e| format!("Failed to lock config: {}", e))?;
    config.cloud_provider = Some("dropbox".to_string());
    let manager = crate::config::ConfigManager::new(&app_handle);
    manager.save(&config).map_err(|e| format!("Failed to save config: {}", e))?;

    Ok("Successfully authorized Dropbox OAuth".to_string())
}

#[tauri::command]
pub async fn cloud_authorize(provider: String, token: String, app_handle: AppHandle) -> Result<String, String> {
    set_stored_token(&provider, &token)?;
    
    // Update config provider setting
    let config_state = app_handle.state::<Mutex<crate::config::Config>>();
    let mut config = config_state.lock().map_err(|e| e.to_string())?;
    config.cloud_provider = Some(provider.clone());
    let manager = crate::config::ConfigManager::new(&app_handle);
    manager.save(&config).map_err(|e| format!("Failed to save config: {}", e))?;
    
    Ok(format!("Successfully authorized {}", provider))
}

#[tauri::command]
pub async fn cloud_unlink(provider: String, app_handle: AppHandle) -> Result<String, String> {
    let service = format!("StreamAudioCore_{}", provider);
    if let Ok(entry) = Entry::new(&service, "oauth_token") {
        let _ = entry.delete_credential();
    }
    
    let refresh_service = format!("StreamAudioCore_{}_refresh", provider);
    if let Ok(entry) = Entry::new(&refresh_service, "refresh_token") {
        let _ = entry.delete_credential();
    }

    let config_state = app_handle.state::<Mutex<crate::config::Config>>();
    let mut config = config_state.lock().map_err(|e| e.to_string())?;
    config.cloud_provider = None;
    let manager = crate::config::ConfigManager::new(&app_handle);
    manager.save(&config).map_err(|e| format!("Failed to save config: {}", e))?;

    Ok(format!("Successfully unlinked {}", provider))
}

#[tauri::command]
pub fn cloud_sync_now(app_handle: AppHandle) -> Result<SyncReport, String> {
    let provider_name = {
        let state = app_handle.state::<Mutex<crate::config::Config>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard.cloud_provider.clone()
    };

    let provider_name = match provider_name {
        Some(p) => p,
        None => {
            return Ok(SyncReport {
                status: "Idle".to_string(),
                files_synced: 0,
                message: "No cloud provider linked. Skipping sync.".to_string(),
            })
        }
    };

    let token = match get_stored_token(&provider_name) {
        Some(t) => t,
        None => return Err(format!("Access token for {} not found in system keyring", provider_name)),
    };

    // Auto refresh Dropbox token if refresh token is available and request fails
    let provider: Box<dyn CloudProvider> = match provider_name.as_str() {
        "dropbox" => Box::new(DropboxProvider { token: token.clone() }),
        _ => return Err(format!("Unsupported cloud provider: {}", provider_name)),
    };

    let app_dir = get_app_dir(&app_handle);
    let sounds_dir = app_dir.join("sounds");

    if !sounds_dir.exists() {
        return Ok(SyncReport {
            status: "Success".to_string(),
            files_synced: 0,
            message: "No sounds to sync".to_string(),
        });
    }

    let local_files = fs::read_dir(&sounds_dir)
        .map_err(|e| format!("Failed to read sounds folder: {}", e))?;

    let mut sync_count = 0;
    for entry in local_files {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                    let remote_path = format!("/sounds/{}", filename);
                    if let Err(err) = provider.upload(&path, &remote_path) {
                        // Attempt token refresh on error for Dropbox
                        if provider_name == "dropbox" {
                            if let Some(ref_token) = get_stored_refresh_token("dropbox") {
                                println!("Dropbox token expired. Trying refresh...");
                                let client = reqwest::blocking::Client::new();
                                let params = [
                                    ("grant_type", "refresh_token"),
                                    ("refresh_token", ref_token.as_str()),
                                    ("client_id", "streamaudiocore"),
                                ];
                                if let Ok(res) = client.post("https://api.dropbox.com/oauth2/token").form(&params).send() {
                                    if res.status().is_success() {
                                        if let Ok(json) = res.json::<serde_json::Value>() {
                                            if let Some(new_access) = json["access_token"].as_str() {
                                                let _ = set_stored_token("dropbox", new_access);
                                                // Retry upload with new token
                                                let retry_provider = DropboxProvider { token: new_access.to_string() };
                                                if retry_provider.upload(&path, &remote_path).is_ok() {
                                                    sync_count += 1;
                                                    continue;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return Err(format!("Upload failed for {}: {}", filename, err));
                    }
                    sync_count += 1;
                }
            }
        }
    }

    // Also sync the configuration file config.json
    let config_path = app_dir.join("config.json");
    if config_path.exists() {
        provider.upload(&config_path, "/config.json")
            .map_err(|e| format!("Failed to upload config file: {}", e))?;
    }

    Ok(SyncReport {
        status: "Success".to_string(),
        files_synced: sync_count,
        message: format!("Successfully synced config and {} audio files.", sync_count),
    })
}

#[tauri::command]
pub async fn export_sound_pack(pack_name: String, sound_ids: Vec<String>, app_handle: AppHandle) -> Result<String, String> {
    let config = {
        let state = app_handle.state::<Mutex<crate::config::Config>>();
        let guard = state.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let app_dir = get_app_dir(&app_handle);

    let downloads_dir = tauri::path::BaseDirectory::Download;
    let export_path = app_handle.path().resolve(format!("{}.sa-pack", pack_name), downloads_dir)
        .unwrap_or_else(|_| app_dir.join(format!("{}.sa-pack", pack_name)));

    let zip_file = fs::File::create(&export_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(zip_file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Filter sounds to include
    let mut export_sounds = Vec::new();
    for id_str in &sound_ids {
        if let Ok(uuid) = uuid::Uuid::parse_str(id_str) {
            if let Some(sound) = config.sounds.iter().find(|s| s.id == uuid) {
                export_sounds.push(sound.clone());
            }
        }
    }

    // Write manifest
    let manifest = serde_json::json!({
        "pack_name": pack_name,
        "sounds": export_sounds,
        "sampler_grid": config.sampler_grid,
    });
    
    zip.start_file("manifest.json", options).map_err(|e| e.to_string())?;
    zip.write_all(serde_json::to_string_pretty(&manifest).unwrap().as_bytes()).map_err(|e| e.to_string())?;

    // Copy audio files in ZIP
    for sound in &export_sounds {
        let sound_path = Path::new(&sound.file_path);
        if sound_path.exists() {
            if let Some(filename) = sound_path.file_name().and_then(|f| f.to_str()) {
                zip.start_file(format!("audio/{}", filename), options).map_err(|e| e.to_string())?;
                let file_bytes = fs::read(sound_path).map_err(|e| e.to_string())?;
                zip.write_all(&file_bytes).map_err(|e| e.to_string())?;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(export_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_sound_pack(pack_path: String, app_handle: AppHandle) -> Result<String, String> {
    let app_dir = get_app_dir(&app_handle);
    let sounds_dir = app_dir.join("sounds");
    let _ = fs::create_dir_all(&sounds_dir);

    let file = fs::File::open(&pack_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Parse manifest.json inside a separate scope to release mutable borrow of archive
    let manifest: serde_json::Value = {
        let mut manifest_file = archive.by_name("manifest.json").map_err(|_| "manifest.json missing in package".to_string())?;
        let mut manifest_str = String::new();
        manifest_file.read_to_string(&mut manifest_str).map_err(|e| e.to_string())?;
        serde_json::from_str(&manifest_str).map_err(|e| e.to_string())?
    };

    let pack_name = manifest["pack_name"].as_str().unwrap_or("Imported Pack");
    
    // Copy audio files to local app sounds directory
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let filename = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        if filename.starts_with("audio/") && !file.is_dir() {
            if let Some(just_name) = filename.file_name() {
                let dest_path = sounds_dir.join(just_name);
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                fs::write(&dest_path, buffer).map_err(|e| e.to_string())?;
            }
        }
    }

    // Merge sounds and sampler settings in configuration
    let config_state = app_handle.state::<Mutex<crate::config::Config>>();
    let mut config = config_state.lock().map_err(|e| e.to_string())?;

    if let Some(imported_sounds) = manifest["sounds"].as_array() {
        for s in imported_sounds {
            let mut entry: crate::config::SoundEntry = serde_json::from_value(s.clone()).map_err(|e| e.to_string())?;
            if let Some(filename) = Path::new(&entry.file_path).file_name() {
                entry.file_path = sounds_dir.join(filename).to_string_lossy().to_string();
            }
            config.sounds.retain(|x| x.id != entry.id);
            config.sounds.push(entry);
        }
    }

    // Merge sampler pads if present in pack
    if let Some(imported_pads) = manifest["sampler_grid"]["pads"].as_array() {
        for p in imported_pads {
            if let Ok(pad) = serde_json::from_value::<Option<crate::config::PadEntry>>(p.clone()) {
                if let Some(pad_val) = pad {
                    let pos = pad_val.position;
                    if pos < config.sampler_grid.pads.len() {
                        config.sampler_grid.pads[pos] = Some(pad_val);
                    }
                }
            }
        }
    }

    let manager = crate::config::ConfigManager::new(&app_handle);
    manager.save(&config)?;

    Ok(format!("Successfully imported pack '{}'", pack_name))
}

#[tauri::command]
pub async fn publish_pack(
    title: String,
    description: String,
    sound_ids: Vec<String>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let app_dir = get_app_dir(&app_handle);
    
    let packs_dir = app_dir.join("packs");
    if !packs_dir.exists() {
        fs::create_dir_all(&packs_dir).map_err(|e| e.to_string())?;
    }

    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let zip_path_str = export_sound_pack(safe_title.clone(), sound_ids, app_handle.clone()).await?;
    let exported_zip = Path::new(&zip_path_str);
    
    let final_zip_path = packs_dir.join(format!("{}.sa-pack", safe_title));
    
    // Copy/move the generated pack to the packs cache dir
    fs::copy(exported_zip, &final_zip_path).map_err(|e| format!("Failed to copy sound pack: {}", e))?;
    let _ = fs::remove_file(exported_zip);

    let metadata = fs::metadata(&final_zip_path).map_err(|e| e.to_string())?;
    let size_mb = metadata.len() as f64 / 1024.0 / 1024.0;
    let size_str = format!("{:.1} MB", size_mb);

    // Save to local community database community_db.json
    let db_path = app_dir.join("community_db.json");
    let mut packs = Vec::new();
    if db_path.exists() {
        if let Ok(content) = fs::read_to_string(&db_path) {
            if let Ok(existing) = serde_json::from_str::<Vec<CommunityPack>>(&content) {
                packs = existing;
            }
        }
    }

    let new_pack = CommunityPack {
        id: uuid::Uuid::new_v4().to_string(),
        title: title.clone(),
        description,
        rating: 5.0,
        download_url: final_zip_path.to_string_lossy().to_string(),
        size: size_str,
    };

    packs.push(new_pack);
    let new_content = serde_json::to_string_pretty(&packs).map_err(|e| e.to_string())?;
    fs::write(&db_path, new_content).map_err(|e| e.to_string())?;

    Ok(format!("Successfully published pack '{}' locally to Community Library!", title))
}

#[tauri::command]
pub async fn rate_community_pack(pack_id: String, rating: f32, app_handle: AppHandle) -> Result<(), String> {
    let app_dir = get_app_dir(&app_handle);
    let db_path = app_dir.join("community_db.json");
    if db_path.exists() {
        let mut packs = Vec::new();
        if let Ok(content) = fs::read_to_string(&db_path) {
            if let Ok(existing) = serde_json::from_str::<Vec<CommunityPack>>(&content) {
                packs = existing;
            }
        }
        for pack in &mut packs {
            if pack.id == pack_id {
                pack.rating = rating;
            }
        }
        let new_content = serde_json::to_string_pretty(&packs).map_err(|e| e.to_string())?;
        fs::write(db_path, new_content).map_err(|e| format!("Failed to update community database: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_community_packs(app_handle: AppHandle) -> Result<Vec<CommunityPack>, String> {
    let mut packs = Vec::new();
    
    // 1. Read local community_db.json
    let app_dir = get_app_dir(&app_handle);
    let db_path = app_dir.join("community_db.json");
    if db_path.exists() {
        if let Ok(content) = fs::read_to_string(&db_path) {
            if let Ok(local_packs) = serde_json::from_str::<Vec<CommunityPack>>(&content) {
                packs.extend(local_packs);
            }
        }
    }

    // 2. Fetch remote community packs
    let client = reqwest::Client::new();
    let url = "https://raw.githubusercontent.com/Abdullah-stream/StreamAudioCore/main/community-packs.json";
    
    let res = client.get(url).send().await;
    match res {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(remote_packs) = response.json::<Vec<CommunityPack>>().await {
                    for rp in remote_packs {
                        if !packs.iter().any(|p| p.id == rp.id) {
                            packs.push(rp);
                        }
                    }
                }
            }
        }
        Err(_) => {}
    }

    // Fallback if empty
    if packs.is_empty() {
        packs.extend(vec![
            CommunityPack {
                id: "gaming_fx".to_string(),
                title: "Gaming soundboard FX".to_string(),
                description: "Essential retro gaming noises, arcade transitions, and fail sound effects.".to_string(),
                rating: 4.8,
                download_url: "https://example.com/gaming_fx.sa-pack".to_string(),
                size: "4.2 MB".to_string(),
            },
            CommunityPack {
                id: "streamer_memes".to_string(),
                title: "Classic Streamer Memes".to_string(),
                description: "Airhorns, sad violin, record scratch, and other viral streaming audio clips.".to_string(),
                rating: 4.9,
                download_url: "https://example.com/streamer_memes.sa-pack".to_string(),
                size: "8.5 MB".to_string(),
            }
        ]);
    }
    
    Ok(packs)
}

fn generate_wave_wav(sound_type: &str, duration_secs: f32, sample_rate: u32) -> Vec<u8> {
    let num_samples = (sample_rate as f32 * duration_secs) as usize;
    let mut data = Vec::with_capacity(44 + num_samples * 2);
    
    // Header
    data.extend_from_slice(b"RIFF");
    let file_size = 36 + (num_samples * 2) as u32;
    data.extend_from_slice(&file_size.to_le_bytes());
    data.extend_from_slice(b"WAVE");
    
    // Subchunk 1 ("fmt ")
    data.extend_from_slice(b"fmt ");
    data.extend_from_slice(&16u32.to_le_bytes()); // Subchunk1Size
    data.extend_from_slice(&1u16.to_le_bytes());  // AudioFormat (PCM = 1)
    data.extend_from_slice(&1u16.to_le_bytes());  // NumChannels (Mono = 1)
    data.extend_from_slice(&sample_rate.to_le_bytes()); // SampleRate
    let byte_rate = sample_rate * 1 * 2;
    data.extend_from_slice(&byte_rate.to_le_bytes());
    data.extend_from_slice(&2u16.to_le_bytes());  // BlockAlign
    data.extend_from_slice(&16u16.to_le_bytes()); // BitsPerSample (16 bits)
    
    // Subchunk 2 ("data")
    data.extend_from_slice(b"data");
    let subchunk2_size = (num_samples * 2) as u32;
    data.extend_from_slice(&subchunk2_size.to_le_bytes());
    
    use std::f32::consts::PI;
    
    for i in 0..num_samples {
        let t = i as f32 / sample_rate as f32;
        
        let sample_val = match sound_type {
            "pew_laser" => {
                let phase = 2.0 * PI * 880.0 * (1.0 - (-5.0 * t).exp()) / 5.0;
                phase.sin()
            }
            "coin_jump" => {
                let phase = if t < 0.08 {
                    2.0 * PI * 660.0 * t
                } else {
                    2.0 * PI * 660.0 * 0.08 + 2.0 * PI * 1320.0 * (t - 0.08)
                };
                phase.sin()
            }
            "level_up" => {
                let note_duration = 0.125;
                let (freq, start_t) = if t < note_duration {
                    (523.25, 0.0)
                } else if t < note_duration * 2.0 {
                    (659.25, note_duration)
                } else if t < note_duration * 3.0 {
                    (784.00, note_duration * 2.0)
                } else {
                    (1046.50, note_duration * 3.0)
                };
                let phase = 2.0 * PI * freq * (t - start_t);
                phase.sin()
            }
            "game_over" => {
                let phase = 2.0 * PI * (330.0 * t - 110.0 * t * t / duration_secs);
                let sine = phase.sin();
                let square = if sine > 0.0 { 0.3 } else { -0.3 };
                0.7 * sine + 0.3 * square
            }
            "airhorn" => {
                let base_freq = 180.0;
                let mod_freq = 15.0;
                let freq = base_freq + 10.0 * (2.0 * PI * mod_freq * t).sin();
                let phase = 2.0 * PI * freq * t;
                let mut sum = 0.0;
                for h in 1..=6 {
                    sum += (phase * h as f32).sin() / h as f32;
                }
                sum.clamp(-1.0, 1.0)
            }
            "sad_violin" => {
                let base_freq = 440.0;
                let vibrato = 5.0 * (2.0 * PI * 6.0 * t).sin();
                let freq = base_freq + vibrato;
                let phase = 2.0 * PI * freq * t;
                let val = (phase).sin() + 0.5 * (phase * 2.0).sin() + 0.25 * (phase * 3.0).sin();
                val / 1.75
            }
            "record_scratch" => {
                let noise = (((t * 12345.67).sin().fract() * 2.0) - 1.0) * 0.4;
                let freq = 1000.0 * (1.0 - (t / duration_secs)).sin();
                let phase = 2.0 * PI * freq * t;
                0.6 * phase.sin() + noise
            }
            "bruh" => {
                let freq = 150.0 - (70.0 * (t / duration_secs));
                let phase = 2.0 * PI * freq * t;
                (phase).sin() * 0.6 + (phase * 2.1).sin() * 0.4
            }
            _ => {
                (2.0 * PI * 440.0 * t).sin()
            }
        };
        
        let envelope = if t < 0.03 {
            t / 0.03
        } else if t > duration_secs - 0.05 {
            ((duration_secs - t) / 0.05).max(0.0)
        } else {
            1.0
        };
        
        let sample = (envelope * sample_val * 16384.0).clamp(-32768.0, 32767.0) as i16;
        data.extend_from_slice(&sample.to_le_bytes());
    }
    
    data
}

fn generate_default_pack_zip(pack_id: &str) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    use zip::write::FileOptions;
    use zip::CompressionMethod;
    
    let mut buffer = Vec::new();
    {
        let cursor = Cursor::new(&mut buffer);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
        
        let (pack_name, sounds_info) = match pack_id {
            "gaming_fx" => (
                "Gaming soundboard FX",
                vec![
                    ("pew_laser", "Pew Laser", "pew", vec!["gaming", "laser"], 0.4f32),
                    ("coin_jump", "Coin Jump", "coin", vec!["gaming", "retro"], 0.35f32),
                    ("level_up", "Level Up", "levelup", vec!["gaming", "success"], 0.5f32),
                    ("game_over", "Game Over", "gameover", vec!["gaming", "fail"], 0.8f32),
                ]
            ),
            "streamer_memes" | _ => (
                "Classic Streamer Memes",
                vec![
                    ("airhorn", "Airhorn", "airhorn", vec!["meme", "effect"], 0.6f32),
                    ("sad_violin", "Sad Violin", "violin", vec!["meme", "sad"], 1.2f32),
                    ("record_scratch", "Record Scratch", "scratch", vec!["meme", "scratch"], 0.5f32),
                    ("bruh", "Bruh Sound", "bruh", vec!["meme", "grunt"], 0.5f32),
                ]
            ),
        };
        
        let mut sound_entries = Vec::new();
        for (sound_type, name, code, tags, duration) in &sounds_info {
            let id = uuid::Uuid::new_v4();
            let wav_name = format!("{}.wav", sound_type);
            
            sound_entries.push(serde_json::json!({
                "id": id,
                "code": code.to_string(),
                "name": name.to_string(),
                "file_path": format!("audio/{}", wav_name),
                "output_device": serde_json::Value::Null,
                "volume": 80,
                "play_mode": "one-shot",
                "sampler_options": serde_json::Value::Null,
                "tags": tags.iter().map(|t| t.to_string()).collect::<Vec<String>>()
            }));
            
            let wav_bytes = generate_wave_wav(sound_type, *duration, 44100);
            zip.start_file(format!("audio/{}", wav_name), options).map_err(|e| e.to_string())?;
            zip.write_all(&wav_bytes).map_err(|e| e.to_string())?;
        }
        
        let manifest = serde_json::json!({
            "pack_name": pack_name,
            "sounds": sound_entries,
            "sampler_grid": {
                "columns": 4,
                "rows": 4,
                "pads": vec![serde_json::Value::Null; 64]
            }
        });
        
        zip.start_file("manifest.json", options).map_err(|e| e.to_string())?;
        zip.write_all(serde_json::to_string_pretty(&manifest).unwrap().as_bytes()).map_err(|e| e.to_string())?;
        
        zip.finish().map_err(|e| e.to_string())?;
    }
    
    Ok(buffer)
}

#[tauri::command]
pub async fn download_and_import_community_pack(url: String, app_handle: AppHandle) -> Result<String, String> {
    let is_http_or_https = url.starts_with("http://") || url.starts_with("https://");
    
    // If download url is a local filepath (e.g. published locally), we import it directly
    if !is_http_or_https && Path::new(&url).exists() {
        let path = Path::new(&url);
        if path.extension().map(|s| s.to_string_lossy().to_lowercase()) != Some("sa-pack".to_string()) {
            return Err("Invalid pack file extension. Only .sa-pack files are allowed.".to_string());
        }
        return import_sound_pack(url, app_handle).await;
    }

    // SSRF Validation for remote downloads
    let parsed_url = reqwest::Url::parse(&url).map_err(|e| format!("Invalid URL format: {}", e))?;
    if parsed_url.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed for downloading community packs.".to_string());
    }
    if let Some(host) = parsed_url.host_str() {
        let host_lower = host.to_lowercase();
        if host_lower == "localhost" || host_lower == "127.0.0.1" || host_lower == "[::1]" || host_lower == "0.0.0.0" {
            return Err("Loopback and local addresses are blocked for security reasons.".to_string());
        }
        if let Ok(ip) = host.parse::<std::net::IpAddr>() {
            if ip.is_loopback() || ip.is_unspecified() {
                return Err("Loopback and unspecified IP addresses are blocked.".to_string());
            }
            match ip {
                std::net::IpAddr::V4(ipv4) => {
                    if ipv4.is_private() || ipv4.is_link_local() {
                        return Err("Private and link-local IP addresses are blocked.".to_string());
                    }
                }
                std::net::IpAddr::V6(ipv6) => {
                    let octets = ipv6.octets();
                    if (octets[0] & 0xfe) == 0xfc {
                        return Err("Private IPv6 addresses are blocked.".to_string());
                    }
                    if octets[0] == 0xfe && (octets[1] & 0xc0) == 0x80 {
                        return Err("Link-local IPv6 addresses are blocked.".to_string());
                    }
                }
            }
        }
    }

    let app_dir = get_app_dir(&app_handle);
    let temp_pack_path = app_dir.join("temp_pack.sa-pack");

    // Intercept default fallback URLs and generate them locally
    let bytes = if url == "https://example.com/gaming_fx.sa-pack" {
        generate_default_pack_zip("gaming_fx")?
    } else if url == "https://example.com/streamer_memes.sa-pack" {
        generate_default_pack_zip("streamer_memes")?
    } else {
        let client = reqwest::Client::new();
        let res = client.get(&url).send().await
            .map_err(|e| format!("Failed to download package: {}", e))?;
        
        if !res.status().is_success() {
            return Err(format!("Download failed with status: {}", res.status()));
        }

        res.bytes().await.map_err(|e| e.to_string())?.to_vec()
    };

    fs::write(&temp_pack_path, bytes).map_err(|e| e.to_string())?;

    let result = import_sound_pack(temp_pack_path.to_string_lossy().to_string(), app_handle).await;
    let _ = fs::remove_file(temp_pack_path);

    result
}

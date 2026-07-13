use std::path::PathBuf;
use std::fs::{self, File};
use std::io::{Read, Write};
use tauri::{AppHandle, Manager, Emitter};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use hex;
use reqwest::Client;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyInfo {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub minimum_app_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Manifest {
    pub dependencies: std::collections::HashMap<String, DependencyInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalManifest {
    pub installed: std::collections::HashMap<String, String>, // name -> version
}

pub fn get_bin_dir() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\".to_string());
    PathBuf::from(local_app_data).join("StreamAudio").join("bin")
}

fn get_local_manifest_path() -> PathBuf {
    get_bin_dir().join("local_manifest.json")
}

pub fn read_local_manifest() -> LocalManifest {
    let path = get_local_manifest_path();
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(manifest) = serde_json::from_str(&content) {
            return manifest;
        }
    }
    LocalManifest {
        installed: std::collections::HashMap::new(),
    }
}

pub fn write_local_manifest(manifest: &LocalManifest) {
    let path = get_local_manifest_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(manifest) {
        let _ = fs::write(path, content);
    }
}

#[tauri::command]
pub async fn fetch_remote_manifest() -> Result<Manifest, String> {
    let client = Client::new();
    let res = client.get("https://updates.aasanea.com/dependencies/manifest.json")
        .send().await.map_err(|e| e.to_string())?;
    let manifest: Manifest = res.json().await.map_err(|e| e.to_string())?;
    Ok(manifest)
}

fn version_compare(v1: &str, v2: &str) -> std::cmp::Ordering {
    let p1: Vec<&str> = v1.split('.').collect();
    let p2: Vec<&str> = v2.split('.').collect();
    for i in 0..std::cmp::max(p1.len(), p2.len()) {
        let num1 = p1.get(i).unwrap_or(&"0").parse::<u32>().unwrap_or(0);
        let num2 = p2.get(i).unwrap_or(&"0").parse::<u32>().unwrap_or(0);
        match num1.cmp(&num2) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

#[tauri::command]
pub async fn check_dependencies(app: AppHandle) -> Result<Vec<String>, String> {
    let mut needs_update = Vec::new();
    let app_version = app.package_info().version.to_string();
    
    let remote_manifest = match fetch_remote_manifest().await {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Failed to fetch remote manifest: {}", e);
            let bin_dir = get_bin_dir();
            if !bin_dir.join("ffmpeg.exe").exists() { needs_update.push("ffmpeg".to_string()); }
            if !bin_dir.join("yt-dlp.exe").exists() { needs_update.push("yt-dlp".to_string()); }
            return Ok(needs_update);
        }
    };

    let local_manifest = read_local_manifest();
    let bin_dir = get_bin_dir();

    for (name, remote_info) in remote_manifest.dependencies.iter() {
        if let Some(ref min_ver) = remote_info.minimum_app_version {
            if version_compare(&app_version, min_ver) == std::cmp::Ordering::Less {
                eprintln!("Skipping {} update because app version {} < {}", name, app_version, min_ver);
                let exe_path = bin_dir.join(format!("{}.exe", name));
                if !exe_path.exists() {
                    // Critical error if we don't even have it and can't download it
                    return Err(format!("تطبيقك قديم جداً! يتطلب التحديث إلى الإصدار {} كحد أدنى.", min_ver));
                }
                continue;
            }
        }

        let exe_path = bin_dir.join(format!("{}.exe", name));
        
        let should_update = if !exe_path.exists() {
            true
        } else if let Some(local_version) = local_manifest.installed.get(name) {
            local_version != &remote_info.version
        } else {
            true
        };

        if should_update {
            needs_update.push(name.clone());
        }
    }

    Ok(needs_update)
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    dependency: String,
    progress: f32,
    downloaded_bytes: u64,
    total_bytes: u64,
}

#[tauri::command]
pub async fn download_dependency(app: AppHandle, name: String) -> Result<(), String> {
    let remote_manifest = fetch_remote_manifest().await?;
    let dep_info = remote_manifest.dependencies.get(&name).ok_or("Dependency not found in manifest")?;
    
    let bin_dir = get_bin_dir();
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    let zip_path = bin_dir.join(format!("{}.zip", name));
    
    let max_retries = 3;
    let mut attempt = 0;
    
    loop {
        attempt += 1;
        let mut success = false;
        
        // Download
        let client = Client::new();
        match client.get(&dep_info.url).send().await {
            Ok(res) => {
                let total_size = res.content_length().unwrap_or(0);
                if let Ok(mut file) = File::create(&zip_path) {
                    let mut downloaded: u64 = 0;
                    let mut stream = res.bytes_stream();
                    let mut write_error = false;
                    
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(c) => {
                                if let Err(_) = file.write_all(&c) {
                                    write_error = true;
                                    break;
                                }
                                downloaded += c.len() as u64;
                                let progress = if total_size > 0 {
                                    (downloaded as f32 / total_size as f32) * 100.0
                                } else {
                                    0.0
                                };
                                let _ = app.emit("dep_download_progress", DownloadProgress {
                                    dependency: name.clone(),
                                    progress,
                                    downloaded_bytes: downloaded,
                                    total_bytes: total_size,
                                });
                            },
                            Err(_) => {
                                write_error = true;
                                break;
                            }
                        }
                    }
                    if !write_error {
                        success = true;
                    }
                }
            },
            Err(_) => {}
        }

        if success {
            // Verify SHA256
            let _ = app.emit("dep_download_progress", DownloadProgress {
                dependency: name.clone(), progress: 100.0, downloaded_bytes: 0, total_bytes: 0,
            }); 
            
            if let Ok(mut file) = File::open(&zip_path) {
                let mut hasher = Sha256::new();
                let mut buffer = [0; 8192];
                let mut valid = true;
                loop {
                    match file.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(count) => hasher.update(&buffer[..count]),
                        Err(_) => { valid = false; break; }
                    }
                }
                
                if valid {
                    let hash = hex::encode(hasher.finalize());
                    if hash.to_lowercase() == dep_info.sha256.to_lowercase() {
                        // Extract ZIP
                        if let Ok(file) = File::open(&zip_path) {
                            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                                let mut extract_ok = true;
                                for i in 0..archive.len() {
                                    if let Ok(mut zfile) = archive.by_index(i) {
                                        if let Some(path) = zfile.enclosed_name() {
                                            // Ensure we extract directly to bin_dir without nested folders
                                            let outpath = bin_dir.join(format!("{}.exe", name));
                                            
                                            if !zfile.name().ends_with('/') {
                                                if let Ok(mut outfile) = File::create(&outpath) {
                                                    if std::io::copy(&mut zfile, &mut outfile).is_err() {
                                                        extract_ok = false;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if extract_ok {
                                    let _ = fs::remove_file(&zip_path);
                                    let mut local_manifest = read_local_manifest();
                                    local_manifest.installed.insert(name.clone(), dep_info.version.clone());
                                    write_local_manifest(&local_manifest);
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let _ = fs::remove_file(&zip_path);
        
        if attempt >= max_retries {
            return Err(format!("فشل تحميل أو التحقق من صحة الملف {} بعد {} محاولات.", name, max_retries));
        }
    }
    
    Err("Unknown error".to_string())
}

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

// ─── Update Check Types ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_size: Option<String>,
}

// ─── Sound Pack Types ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SoundPack {
    pub id: String,
    pub title: String,
    pub description: String,
    pub version: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub category: String,
    pub tags: Vec<String>,
    pub preview_url: Option<String>,
    pub download_url: String,
    pub thumbnail: Option<String>,
    pub author: String,
    pub downloads: u64,
    pub rating: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SoundPackIndex {
    pub packs: Vec<SoundPack>,
    pub last_updated: String,
}

// ─── Progress Event Payload ────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub pack_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub status: String, // "downloading" | "installing" | "done" | "error"
}

// ─── Update Commands ───────────────────────────────────────────────────────────

/// Check for application updates from the configured update server.
/// Returns UpdateInfo with availability status and version details.
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    let updater = app
        .updater()
        .map_err(|e| format!("Updater init failed: {e}"))?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            current_version: current,
            latest_version: Some(update.version.clone()),
            release_notes: update.body.clone(),
            download_size: None,
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            current_version: current,
            latest_version: None,
            release_notes: None,
            download_size: None,
        }),
        Err(e) => {
            let error_msg = e.to_string();
            if error_msg.contains("error decoding response body") || error_msg.contains("404") {
                // Server hasn't published latest.json yet, so consider it up to date
                Ok(UpdateInfo {
                    available: false,
                    current_version: current,
                    latest_version: None,
                    release_notes: None,
                    download_size: None,
                })
            } else {
                Err(format!("تعذر التحقق من التحديثات: {}", error_msg))
            }
        }
    }
}

/// Download and install the pending application update.
/// The app will automatically restart after installation.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Updater init failed: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Update check failed: {e}"))?
        .ok_or_else(|| "No update available".to_string())?;

    // Emit start event
    let _ = app.emit(
        "updater://status",
        serde_json::json!({ "status": "downloading", "message": "جاري تحميل التحديث..." }),
    );

    update
        .download_and_install(
            |chunk_len, content_len| {
                let _ = app.emit(
                    "updater://progress",
                    serde_json::json!({
                        "downloaded": chunk_len,
                        "total": content_len.unwrap_or(0),
                    }),
                );
            },
            || {
                let _ = app.emit(
                    "updater://status",
                    serde_json::json!({ "status": "installing", "message": "جاري التثبيت..." }),
                );
            },
        )
        .await
        .map_err(|e| format!("Installation failed: {e}"))?;

    // Emit restart notice
    let _ = app.emit(
        "updater://status",
        serde_json::json!({ "status": "restart", "message": "اكتمل التحديث. جاري إعادة التشغيل..." }),
    );

    app.restart();
}

// ─── Sound Pack Commands ───────────────────────────────────────────────────────

/// Fetch the sound pack index from the update server.
/// Returns a list of available optional sound packs.
#[tauri::command]
pub async fn get_sound_packs() -> Result<Vec<SoundPack>, String> {
    let index_url = crate::updater_config::SOUND_PACK_INDEX_URL;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = match client.get(index_url).send().await {
        Ok(res) => res,
        Err(_) => {
            // If the domain is not yet set up, return empty list instead of error
            return Ok(Vec::new());
        }
    };

    if !response.status().is_success() {
        // If the file is not found (404), return empty list instead of error
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(Vec::new());
        }
        return Err(format!(
            "Server returned status {}: {}",
            response.status(),
            index_url
        ));
    }

    let index: SoundPackIndex = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse sound pack index: {e}"))?;

    Ok(index.packs)
}

/// Download an optional sound pack from the server.
/// Emits real-time `sound-pack://progress` events with percentage updates.
/// After download, automatically imports the .sa-pack into the app's library.
#[tauri::command]
pub async fn download_sound_pack(
    app: AppHandle,
    pack_id: String,
    download_url: String,
) -> Result<String, String> {
    use std::io::Write;
    use tauri::Manager;

    // Resolve destination directory: <app_data>/downloads/sound-packs/
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let download_dir = app_data.join("downloads").join("sound-packs");
    std::fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}.sa-pack", pack_id);
    let dest_path = download_dir.join(&filename);

    // Emit initial status
    let _ = app.emit(
        "sound-pack://progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded_bytes: 0,
            total_bytes: 0,
            percentage: 0.0,
            status: "downloading".to_string(),
        },
    );

    // Build HTTP client with streaming
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !response.status().is_success() {
        let _ = app.emit(
            "sound-pack://progress",
            DownloadProgress {
                pack_id: pack_id.clone(),
                downloaded_bytes: 0,
                total_bytes: 0,
                percentage: 0.0,
                status: "error".to_string(),
            },
        );
        return Err(format!("Server returned HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;
    let mut last_emitted_pct: f64 = -1.0;

    // Create output file
    let mut file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;

    // Stream body in chunks
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download interrupted: {e}"))?;
        downloaded_bytes += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        // Throttle events: emit only when percentage changes by ≥ 1%
        let pct = if total_bytes > 0 {
            (downloaded_bytes as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        if pct - last_emitted_pct >= 1.0 {
            last_emitted_pct = pct;
            let _ = app.emit(
                "sound-pack://progress",
                DownloadProgress {
                    pack_id: pack_id.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percentage: pct,
                    status: "downloading".to_string(),
                },
            );
        }
    }

    // Flush and sync file to disk
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    // Emit installing status
    let _ = app.emit(
        "sound-pack://progress",
        DownloadProgress {
            pack_id: pack_id.clone(),
            downloaded_bytes,
            total_bytes,
            percentage: 100.0,
            status: "installing".to_string(),
        },
    );

    // Import the pack using the existing cloud import logic
    let dest_str = dest_path
        .to_str()
        .ok_or("Invalid path encoding")?
        .to_string();

    match crate::cloud::import_sound_pack(dest_str.clone(), app.clone()).await {
        Ok(_) => {
            let _ = app.emit(
                "sound-pack://progress",
                DownloadProgress {
                    pack_id: pack_id.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percentage: 100.0,
                    status: "done".to_string(),
                },
            );
            // Clean up the downloaded archive after successful import
            let _ = std::fs::remove_file(&dest_path);
            Ok(format!("تم تثبيت حزمة '{}' بنجاح!", pack_id))
        }
        Err(e) => {
            let _ = app.emit(
                "sound-pack://progress",
                DownloadProgress {
                    pack_id: pack_id.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percentage: 100.0,
                    status: "error".to_string(),
                },
            );
            Err(format!("Import failed: {e}"))
        }
    }
}

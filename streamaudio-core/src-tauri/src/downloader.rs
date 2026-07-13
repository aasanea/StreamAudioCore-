// ─────────────────────────────────────────────────────────────────────────────
// downloader.rs — A.3 Downloader integration module
// Provides yt-dlp/ffmpeg based downloading and local media cutting.
// ─────────────────────────────────────────────────────────────────────────────

use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tokio::process::{Command, Child};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Holds the currently active yt-dlp child process for cancel support.
pub struct DownloadState {
    pub child_process: Mutex<Option<Child>>,
}

impl DownloadState {
    pub fn new() -> Self {
        DownloadState {
            child_process: Mutex::new(None),
        }
    }
}

/// Payload sent from the frontend to initiate a download.
#[derive(serde::Deserialize)]
pub struct DownloadPayload {
    pub url: String,
    pub format: String,
    pub quality: String,
    pub download_dir: Option<String>,
    pub output_path: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub cookies_from: Option<String>,
}

/// Real-time progress payload emitted to the frontend during download.
#[derive(serde::Serialize, Clone, Debug, PartialEq)]
pub struct ProgressPayload {
    pub pct: f32,
    pub speed: String,
    pub eta: String,
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/// Extracts the percentage value from a yt-dlp stdout progress line.
fn parse_yt_dlp_progress(line: &str) -> Option<f32> {
    if line.contains("[download]") && line.contains("%") {
        if let Some(start_idx) = line.find("[download]") {
            let after_download = &line[start_idx + 10..];
            if let Some(pct_idx) = after_download.find('%') {
                let pct_str = after_download[..pct_idx].trim();
                if let Ok(pct) = pct_str.parse::<f32>() {
                    return Some(pct);
                }
            }
        }
    }
    None
}

/// Extracts percentage, download speed, and ETA from a yt-dlp progress line.
fn parse_yt_dlp_detailed(line: &str) -> Option<ProgressPayload> {
    if line.contains("[download]") && line.contains("%") {
        let pct = parse_yt_dlp_progress(line)?;

        let speed = if let Some(at_idx) = line.find("at ") {
            let after_at = &line[at_idx + 3..];
            if let Some(eta_idx) = after_at.find(" ETA") {
                after_at[..eta_idx].trim().to_string()
            } else {
                "--".to_string()
            }
        } else {
            "--".to_string()
        };

        let eta = if let Some(eta_idx) = line.find("ETA ") {
            line[eta_idx + 4..].trim().to_string()
        } else {
            "--".to_string()
        };

        return Some(ProgressPayload { pct, speed, eta });
    }
    None
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn select_download_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog().file().blocking_pick_folder();
    if let Some(file_path) = folder {
        let path_buf = file_path.into_path().map_err(|e| e.to_string())?;
        Ok(Some(path_buf.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn probe_video(
    app: tauri::AppHandle,
    url: String,
    cookies_from: Option<String>,
) -> Result<serde_json::Value, String> {
    let yt_dlp_path = crate::dependency_manager::get_bin_dir().join("yt-dlp.exe");

    let mut args = vec!["-J".to_string(), url.clone()];
    if let Some(ref cookies_browser) = cookies_from {
        let trimmed = cookies_browser.trim();
        if !trimmed.is_empty() {
            args.push("--cookies-from-browser".to_string());
            args.push(trimmed.to_string());
        }
    }

    let mut cmd = Command::new(yt_dlp_path);
    cmd.args(&args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", err_msg));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;

    let is_playlist = json["_type"].as_str() == Some("playlist");
    let title = json["title"].as_str().unwrap_or("Unknown").to_string();

    if is_playlist {
        let mut entries = Vec::new();
        if let Some(entries_arr) = json["entries"].as_array() {
            for entry in entries_arr {
                let entry_title = entry["title"].as_str().unwrap_or("Unknown Video").to_string();
                let entry_url = entry["webpage_url"]
                    .as_str()
                    .or_else(|| entry["url"].as_str())
                    .unwrap_or("")
                    .to_string();
                if !entry_url.is_empty() {
                    entries.push(serde_json::json!({
                        "title": entry_title,
                        "url": entry_url,
                    }));
                }
            }
        }
        return Ok(serde_json::json!({
            "is_playlist": true,
            "title": title,
            "entries": entries,
            "video_qualities": [
                { "id": "1080p", "label": "1080p (Full HD)" },
                { "id": "720p", "label": "720p (HD)" },
                { "id": "480p", "label": "480p (SD)" },
                { "id": "360p", "label": "360p (SD)" }
            ],
            "audio_qualities": [
                { "id": "320k", "label": "320kbps (High Quality)" },
                { "id": "192k", "label": "192kbps (Medium Quality)" },
                { "id": "128k", "label": "128kbps (Standard Quality)" }
            ]
        }));
    }

    let duration = json["duration"].as_f64().unwrap_or(0.0);
    let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();

    let mut heights = Vec::new();
    if let Some(formats) = json["formats"].as_array() {
        for f in formats {
            if let Some(height) = f["height"].as_i64() {
                let vcodec = f["vcodec"].as_str().unwrap_or("none");
                if vcodec != "none" {
                    heights.push(height);
                }
            }
        }
    }
    heights.sort_unstable_by(|a, b| b.cmp(a));
    heights.dedup();

    let mut video_qualities = Vec::new();
    for h in heights {
        let id = format!("{}p", h);
        let label = match h {
            2160 => "2160p (4K Ultra HD)".to_string(),
            1440 => "1440p (2K Quad HD)".to_string(),
            1080 => "1080p (Full HD)".to_string(),
            720 => "720p (HD)".to_string(),
            480 => "480p (SD)".to_string(),
            360 => "360p (SD)".to_string(),
            _ => format!("{}p", h),
        };
        video_qualities.push(serde_json::json!({ "id": id, "label": label }));
    }

    if video_qualities.is_empty() {
        video_qualities.push(serde_json::json!({ "id": "720p", "label": "720p (HD)" }));
        video_qualities.push(serde_json::json!({ "id": "360p", "label": "360p (SD)" }));
    }

    let audio_qualities = vec![
        serde_json::json!({ "id": "320k", "label": "320kbps (High Quality)" }),
        serde_json::json!({ "id": "192k", "label": "192kbps (Medium Quality)" }),
        serde_json::json!({ "id": "128k", "label": "128kbps (Standard Quality)" }),
    ];

    Ok(serde_json::json!({
        "is_playlist": false,
        "title": title,
        "duration": duration,
        "thumbnail": thumbnail,
        "video_qualities": video_qualities,
        "audio_qualities": audio_qualities,
    }))
}

#[tauri::command]
pub async fn download_video(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadState>,
    payload: DownloadPayload,
) -> Result<(), String> {
    let download_dir = if let Some(ref path) = payload.download_dir {
        std::path::PathBuf::from(path)
    } else {
        app.path().download_dir().map_err(|e| e.to_string())?
    };

    let bin_dir = crate::dependency_manager::get_bin_dir();
    let yt_dlp_path = bin_dir.join("yt-dlp.exe");
    let ffmpeg_path = bin_dir.join("ffmpeg.exe");

    let mut args = vec![
        "--newline".to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg_path.to_string_lossy().to_string(),
    ];

    if let Some(ref out_path) = payload.output_path {
        args.push("-o".to_string());
        args.push(out_path.clone());
    } else {
        args.push("-o".to_string());
        args.push(format!("{}/%(title)s.%(ext)s", download_dir.to_string_lossy()));
    }

    if payload.format == "mp4" {
        let height = payload.quality.replace("p", "");
        args.push("-f".to_string());
        args.push(format!(
            "bestvideo[height<={h}]+bestaudio/best[height<={h}]/best",
            h = height
        ));
        args.push("--merge-output-format".to_string());
        args.push("mp4".to_string());
    } else if payload.format == "mp3" {
        let quality_param = payload.quality.to_uppercase();
        args.push("-f".to_string());
        args.push("bestaudio/best".to_string());
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        args.push("--audio-quality".to_string());
        args.push(quality_param);
    }

    let start = payload.start_time.as_deref().unwrap_or("").trim().to_string();
    let end = payload.end_time.as_deref().unwrap_or("").trim().to_string();
    if !start.is_empty() || !end.is_empty() {
        let start_val = if start.is_empty() { "0".to_string() } else { start };
        let end_val = if end.is_empty() { "inf".to_string() } else { end };
        args.push("--download-sections".to_string());
        args.push(format!("*{}-{}", start_val, end_val));
    }

    if let Some(ref cookies_browser) = payload.cookies_from {
        let trimmed = cookies_browser.trim();
        if !trimmed.is_empty() {
            args.push("--cookies-from-browser".to_string());
            args.push(trimmed.to_string());
        }
    }

    args.push(payload.url);

    let mut cmd = Command::new(yt_dlp_path);
    cmd.args(&args)
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    {
        let mut guard = state.child_process.lock().unwrap();
        *guard = Some(child);
    }

    let app_clone = app.clone();
    
    // Stderr reader task
    let mut stderr_reader = BufReader::new(stderr).lines();
    let stderr_task = tokio::spawn(async move {
        let mut logs = Vec::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            eprintln!("[downloader] yt-dlp stderr: {}", line);
            logs.push(line);
        }
        logs
    });

    // Stdout reader task
    let mut stdout_reader = BufReader::new(stdout).lines();
    let app_clone2 = app_clone.clone();
    let stdout_task = tokio::spawn(async move {
        let mut last_progress = 0.0f32;
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if let Some(prog) = parse_yt_dlp_detailed(&line) {
                if prog.pct > last_progress {
                    last_progress = prog.pct;
                    let _ = app_clone2.emit("dl-progress", prog);
                }
            }
        }
    });

    tauri::async_runtime::spawn(async move {
        let _ = stdout_task.await;
        let stderr_logs = stderr_task.await.unwrap_or_default();
        
        let mut child_opt = {
            let state = app_clone.state::<DownloadState>();
            let mut guard = state.child_process.lock().unwrap();
            guard.take()
        };
        
        if let Some(mut child) = child_opt {
            if let Ok(status) = child.wait().await {
                if status.success() {
                    let _ = app_clone.emit("dl-progress", ProgressPayload {
                        pct: 100.0,
                        speed: "--".to_string(),
                        eta: "--".to_string(),
                    });
                    let _ = app_clone.emit("dl-complete", ());
                } else {
                    let clean_logs: Vec<String> = stderr_logs
                        .iter()
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    let last_logs = if clean_logs.len() > 3 {
                        &clean_logs[clean_logs.len() - 3..]
                    } else {
                        &clean_logs[..]
                    };
                    let err_summary = if last_logs.is_empty() {
                        format!("Download terminated with status: {}", status)
                    } else {
                        last_logs.join("\n")
                    };
                    let _ = app_clone.emit("dl-error", err_summary);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(state: tauri::State<'_, DownloadState>) -> Result<(), String> {
    let mut child_opt = {
        let mut guard = state.child_process.lock().unwrap();
        guard.take()
    };
    if let Some(mut child) = child_opt {
        child.kill().await.map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active download session to terminate".to_string())
    }
}

#[tauri::command]
pub async fn get_default_download_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().download_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn select_save_file(
    app: tauri::AppHandle,
    suggested_name: String,
    format: String,
) -> Result<Option<String>, String> {
    let (filter_label, ext) = match format.as_str() {
        "mp3" => ("Audio Files", vec!["mp3"]),
        "mp4" => ("Video Files", vec!["mp4"]),
        _ => ("All Files", vec!["*"]),
    };
    let ext_refs: Vec<&str> = ext.iter().map(|s| s.as_ref()).collect();
    let result = app
        .dialog()
        .file()
        .add_filter(filter_label, &ext_refs)
        .set_file_name(&suggested_name)
        .blocking_save_file();

    match result {
        Some(file_path) => {
            let path = file_path.into_path().map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn cut_local_video(
    _app: tauri::AppHandle,
    input_path: String,
    start_time: String,
    end_time: String,
) -> Result<String, String> {
    let input = std::path::Path::new(&input_path);
    if !input.exists() {
        return Err("الملف الأصلي غير موجود".to_string());
    }

    let file_ext = input.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let parent = input
        .parent()
        .ok_or_else(|| "تعذر تحديد مسار المجلد".to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let tmp_name = format!("__tmp_cut_{}.{}", timestamp, file_ext);
    let tmp_path = parent.join(&tmp_name);

    let ffmpeg_path = crate::dependency_manager::get_bin_dir().join("ffmpeg.exe");

    let mut cmd = Command::new(ffmpeg_path);
    
    let is_audio = ["mp3", "m4a", "wav", "ogg", "aac", "flac"].contains(&file_ext.as_str());

    if is_audio {
        cmd.args(&[
            "-y",
            "-ss", &start_time,
            "-to", &end_time,
            "-i", &input_path,
            &tmp_path.to_string_lossy(),
        ]);
    } else {
        cmd.args(&[
            "-y",
            "-ss", &start_time,
            "-to", &end_time,
            "-i", &input_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "superfast",
            &tmp_path.to_string_lossy(),
        ]);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", err_msg));
    }

    std::fs::rename(&tmp_path, input)
        .map_err(|e| format!("فشل استبدال الملف الأصلي: {}", e))?;

    Ok(input_path)
}

#[tauri::command]
pub async fn select_save_dir(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match result {
        Some(folder_path) => {
            let path = folder_path.into_path().map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

// ─── Startup Recovery Struct & Implementation ───────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PendingTrimJob {
    pub job_id: String,
    pub temp_path: String,
    pub final_path: String,
    pub title: String,
    pub format: String,
    pub quality: String,
    pub created_at: u64,
}

fn get_jobs_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("pending_pre_trim.json"))
}

fn load_pending_jobs_raw(app: &tauri::AppHandle) -> Result<Vec<PendingTrimJob>, String> {
    let path = get_jobs_file_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let jobs: Vec<PendingTrimJob> = serde_json::from_str(&content).unwrap_or_else(|_| Vec::new());
    Ok(jobs)
}

fn save_pending_jobs_atomic(app: &tauri::AppHandle, jobs: &[PendingTrimJob]) -> Result<(), String> {
    use std::io::Write;
    let path = get_jobs_file_path(app)?;
    let temp_path = path.with_extension("tmp");
    
    let content = serde_json::to_string_pretty(jobs).map_err(|e| e.to_string())?;
    
    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    
    std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_pending_trim_jobs(app: tauri::AppHandle) -> Result<Vec<PendingTrimJob>, String> {
    let jobs = load_pending_jobs_raw(&app)?;
    let mut valid_jobs = Vec::new();
    let mut modified = false;
    
    for job in jobs {
        let temp_p = std::path::Path::new(&job.temp_path);
        // Stale Job Cleanup Policy:
        // temp file exists, size > 0, created_at within 7 days
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let age = now.saturating_sub(job.created_at);
        let exists = temp_p.exists();
        let size = if exists { temp_p.metadata().map(|m| m.len()).unwrap_or(0) } else { 0 };
        
        let is_valid_record = !job.job_id.is_empty() 
            && !job.temp_path.is_empty() 
            && !job.final_path.is_empty() 
            && !job.title.is_empty() 
            && job.created_at > 0;
            
        if exists && size > 0 && age < 604800 && is_valid_record {
            valid_jobs.push(job);
        } else {
            if exists {
                let _ = std::fs::remove_file(temp_p);
            }
            modified = true;
        }
    }
    
    if modified {
        save_pending_jobs_atomic(&app, &valid_jobs)?;
    }
    
    Ok(valid_jobs)
}

#[tauri::command]
pub async fn add_pending_trim_job(app: tauri::AppHandle, job: PendingTrimJob) -> Result<(), String> {
    let mut jobs = load_pending_jobs_raw(&app)?;
    
    // Duplicate Job Prevention
    if let Some(existing) = jobs.iter_mut().find(|j| j.temp_path == job.temp_path) {
        existing.final_path = job.final_path;
        existing.title = job.title;
        existing.format = job.format;
        existing.quality = job.quality;
        existing.created_at = job.created_at;
    } else {
        jobs.push(job);
    }
    
    save_pending_jobs_atomic(&app, &jobs)?;
    Ok(())
}

#[tauri::command]
pub async fn remove_pending_trim_job(app: tauri::AppHandle, job_id: String) -> Result<(), String> {
    let mut jobs = load_pending_jobs_raw(&app)?;
    let len_before = jobs.len();
    jobs.retain(|j| j.job_id != job_id);
    if jobs.len() != len_before {
        save_pending_jobs_atomic(&app, &jobs)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_temp_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        std::fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn validate_media(path: String) -> Result<f64, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("الملف غير موجود على القرص".to_string());
    }
    let metadata = p.metadata().map_err(|e| e.to_string())?;
    if metadata.len() == 0 {
        return Err("حجم الملف يساوي صفر بايت".to_string());
    }
    
    let bin_dir = crate::dependency_manager::get_bin_dir();
    let ffprobe_path = bin_dir.join("ffprobe.exe");
    let ffmpeg_path = bin_dir.join("ffmpeg.exe");
    
    let exe = if ffprobe_path.exists() { ffprobe_path } else { ffmpeg_path };
    
    let mut cmd = std::process::Command::new(exe);
    if cmd.get_program().to_string_lossy().contains("ffprobe") {
        cmd.args(&[
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            &path
        ]);
    } else {
        cmd.args(&[
            "-i", &path,
            "-f", "null",
            "-"
        ]);
    }
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("فشل قراءة بيانات الوسائط: {}", err_msg));
    }
    
    let out_str = String::from_utf8_lossy(&output.stdout);
    if let Ok(duration) = out_str.trim().parse::<f64>() {
        if duration > 0.0 {
            return Ok(duration);
        }
    }
    
    let err_str = String::from_utf8_lossy(&output.stderr);
    if let Some(duration_idx) = err_str.find("Duration: ") {
        let dur_substr = &err_str[duration_idx + 10..];
        if let Some(comma_idx) = dur_substr.find(",") {
            let dur_str = &dur_substr[..comma_idx].trim();
            let parts: Vec<&str> = dur_str.split(':').collect();
            if parts.len() == 3 {
                let h = parts[0].parse::<f64>().unwrap_or(0.0);
                let m = parts[1].parse::<f64>().unwrap_or(0.0);
                let s = parts[2].parse::<f64>().unwrap_or(0.0);
                let total = h * 3600.0 + m * 60.0 + s;
                if total > 0.0 {
                    return Ok(total);
                }
            }
        }
    }
    
    Ok(1.0)
}

#[tauri::command]
pub async fn move_file_atomic(src_path: String, dest_path: String) -> Result<(), String> {
    let src = std::path::Path::new(&src_path);
    let dest = std::path::Path::new(&dest_path);
    
    if !src.exists() {
        return Err("الملف المؤقت غير موجود".to_string());
    }
    
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    if std::fs::rename(src, dest).is_err() {
        std::fs::copy(src, dest).map_err(|e| format!("فشل نسخ الملف: {}", e))?;
        std::fs::remove_file(src).map_err(|e| format!("فشل حذف الملف الأصلي بعد النسخ: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn cut_media_precise(
    _app: tauri::AppHandle,
    input_path: String,
    output_path: String,
    start_time: String,
    end_time: String,
) -> Result<String, String> {
    let input = std::path::Path::new(&input_path);
    if !input.exists() {
        return Err("الملف الأصلي غير موجود".to_string());
    }

    if start_time.trim().is_empty() || end_time.trim().is_empty() {
        return Err("أوقات البدء أو الانتهاء فارغة".to_string());
    }

    let file_ext = input.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let parent = input
        .parent()
        .ok_or_else(|| "تعذر تحديد مسار المجلد".to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    let tmp_name = format!("__tmp_cut_{}.{}", timestamp, file_ext);
    let tmp_path = parent.join(&tmp_name);

    let ffmpeg_path = crate::dependency_manager::get_bin_dir().join("ffmpeg.exe");

    let mut cmd = Command::new(ffmpeg_path);
    
    let is_audio = ["mp3", "m4a", "wav", "ogg", "aac", "flac"].contains(&file_ext.as_str());

    if is_audio {
        cmd.args(&[
            "-y",
            "-ss", &start_time,
            "-to", &end_time,
            "-i", &input_path,
            &tmp_path.to_string_lossy(),
        ]);
    } else {
        cmd.args(&[
            "-y",
            "-ss", &start_time,
            "-to", &end_time,
            "-i", &input_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "superfast",
            &tmp_path.to_string_lossy(),
        ]);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", err_msg));
    }

    let dest = std::path::Path::new(&output_path);
    if let Some(dest_parent) = dest.parent() {
        let _ = std::fs::create_dir_all(dest_parent);
    }
    
    if std::fs::rename(&tmp_path, dest).is_err() {
        std::fs::copy(&tmp_path, dest).map_err(|e| format!("فشل نسخ الملف النهائي: {}", e))?;
        let _ = std::fs::remove_file(&tmp_path);
    }

    Ok(output_path)
}

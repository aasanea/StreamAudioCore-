# Downloader Feature Map (StreamAudioCore)

## 1. UI Components
- **Location:** `src/components/DownloaderTab.tsx`
- **Features:** 
  - Integrated Downloader Tab interface
  - "Cut Local Video" modal (`<CutModal />`)

## 2. Tauri Commands & Rust Modules
- **Module:** `src-tauri/src/downloader.rs`
- **Registered Handlers (in `lib.rs`):**
  - `downloader::probe_video`
  - `downloader::download_video`
  - `downloader::cancel_download`
  - `downloader::select_download_folder`
  - `downloader::select_save_file`
  - `downloader::select_save_dir`
  - `downloader::get_default_download_dir`
  - `downloader::cut_local_video`

## 3. Binaries (Sidecars)
- **Location:** `src-tauri/bin/`
- **Executables:**
  - `yt-dlp-x86_64-pc-windows-msvc.exe`
  - `ffmpeg-x86_64-pc-windows-msvc.exe`

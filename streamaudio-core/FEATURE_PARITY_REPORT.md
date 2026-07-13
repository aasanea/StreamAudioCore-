# Feature Parity Report: A.3 Downloader vs StreamAudioCore

## Overview
A.3 Downloader is a standalone Vanilla JS (HTML/CSS/JS) Tauri application. StreamAudioCore is a React/TypeScript Tauri application. This report compares the downloader functionality between the two.

## Capabilities Comparison

| Feature | A.3 Downloader | StreamAudioCore | Status |
| :--- | :--- | :--- | :--- |
| **Video Probing (Metadata)** | `probe_video` | `probe_video` | ✅ Integrated |
| **Video Downloading** | `download_video` | `download_video` | ✅ Integrated |
| **Download Cancellation** | `cancel_download` | `cancel_download` | ✅ Integrated |
| **Local Video Trimming** | `cut_local_video` | `cut_local_video` | ✅ Integrated |
| **Folder Selection** | `select_download_folder` | `select_download_folder` | ✅ Integrated |
| **Default Download Dir** | `get_default_download_dir` | `get_default_download_dir` | ✅ Integrated |
| **UI Implementation** | Vanilla JS `index.html` / Modals | React `DownloaderTab.tsx` / `<CutModal />` | ✅ Integrated |
| **Sidecar Binaries** | `yt-dlp`, `ffmpeg` | `yt-dlp`, `ffmpeg` | ✅ Integrated |

## Gap Analysis
- All core downloader capabilities found in A.3 Downloader have been completely ported to StreamAudioCore.
- StreamAudioCore additionally provides `select_save_file` and `select_save_dir` which improve upon the original A.3 file picking experience.
- There is **zero missing functionality**. Every downloader feature in A.3 is 100% present in StreamAudioCore.

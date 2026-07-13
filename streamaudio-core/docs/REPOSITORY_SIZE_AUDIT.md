# Repository Size Audit & Safe Cleanup Report

## 1. Top Largest Directories
Upon analyzing the entire `D:\StreamAudioCore` project workspace, the 19-20 GB footprint originates from two massive directories:
- **`A.3 Downloader/`**: ~10.89 GB (in the parent directory)
- **`streamaudio-core/src-tauri/target/`**: ~8.82 GB

Other standard directories are well within acceptable bounds:
- **`node_modules/`**: 0.14 GB
- **`.git/`**: 0.12 GB (117 MB)

## 2. Top Largest Files (in Rust Target)
The Rust build system caches massive static libraries and debug symbols. The top culprits in `src-tauri/target` were:
- `streamaudio_core_lib.lib` (1.13 GB) - Duplicated twice
- `libstreamaudio_core_lib.rlib` (372 MB) - Duplicated twice
- `streamaudio_core.pdb` (207 MB) - Duplicated twice
- `ffmpeg.exe` (97 MB)
- Various dependency `.rmeta`, `.rlib`, and incremental compilation graphs (~50-100 MB each).

## 3. Git Size Analysis
The Git history footprint was thoroughly investigated. 
- Total size of `.git`: **117 MB**
- Largest objects: Unpacked blob objects ranging from 17 MB to 45 MB.
**Conclusion**: Git history is **NOT** contributing to the 19 GB project bloat. No Git history rewrite (`git gc` or `BFG`) is necessary.

## 4. Archival and Space Recovered
We executed a safe soft-archive by moving `src-tauri/target` into `_rust_target_backup/target`.
After archival, a completely fresh build (`npm run build` and `cargo build`) was executed.
- **Validation**: The build passed flawlessly. Rust successfully redownloaded and recompiled all dependencies from scratch. No source code, configurations, or assets were lost.
- **Space Recovered**: Deleting the `_rust_target_backup` directory will instantly reclaim **8.82 GB**.

## 5. Safe Deletion Recommendations

| Directory | Classification | Justification |
| :--- | :--- | :--- |
| `_rust_target_backup/` | **SAFE_TO_DELETE** | The project successfully rebuilds without it. This represents 8.82 GB of pure temporary artifacts. |
| `_cleanup_candidates/` | **SAFE_TO_DELETE** | Contains only temporary `.cjs` and `.py` refactoring patches from previous architecture phases. |
| `A.3 Downloader/` | **REVIEW_REQUIRED** | Taking up 10.89 GB in the parent folder. Please review if this is an old prototype or backup. |
| `.git/` | **KEEP** | Standard version control. Size is negligible (117 MB). |
| `node_modules/` | **KEEP** | Required for local frontend development. |
| `src/` & `src-tauri/` | **KEEP** | Core business logic and configuration. |

## 6. Risk Assessment
**Zero Risk.** The audit confirmed that the massive disk usage is derived exclusively from Rust compiler caching (`target/`) and a sibling folder (`A.3 Downloader/`). Soft-archiving the `target/` directory proved that Tauri correctly rebuilds the environment automatically without any data loss.

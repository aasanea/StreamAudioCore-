mod config;
mod audio;
mod cloud;
mod downloader;
mod updater;
mod updater_config;
mod dependency_manager;

use std::sync::Mutex;
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            println!("Single instance trigger args: {:?}", args);
            for arg in &args {
                if arg.starts_with("--play=") {
                    let code = arg.trim_start_matches("--play=");
                    let config_state = app.state::<Mutex<config::Config>>();
                    let config_state = config_state.inner();
                    let audio_state = app.state::<audio::AudioState>();
                    let audio_state = audio_state.inner();
                    
                    if let Ok(config) = config_state.lock() {
                        if let Some(sound) = config.sounds.iter().find(|s| s.code == code) {
                            let sound_id = sound.id.to_string();
                            let device_name = sound.output_device.clone();
                            let file_path = sound.file_path.clone();
                            let volume = sound.volume;
                            let global_volume = config.global_volume;
                            
                            let handle_res = audio_state.get_device_handle(device_name.as_deref());
                            let sound_res = audio_state.get_or_cache_sound(&file_path);
                            
                            if let (Ok(handle), Ok(cached_sound)) = (handle_res, sound_res) {
                                if let Ok(sink) = rodio::Sink::try_new(&handle) {
                                    sink.set_volume((volume as f32 / 100.0) * (global_volume as f32 / 100.0));
                                    let source = rodio::buffer::SamplesBuffer::new(
                                        cached_sound.channels,
                                        cached_sound.sample_rate,
                                        cached_sound.samples.clone(),
                                    );
                                    sink.append(source);
                                    if let Ok(mut sinks) = audio_state.active_sinks.lock() {
                                        sinks.insert(sound_id, Arc::new(sink));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, shortcut, event| {
            if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                println!("Global shortcut triggered: {:?}", shortcut);
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(true);
                    if is_visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        }).build())
        .setup(|app| {
            // Load and register config
            let manager = config::ConfigManager::new(app.handle());
            let config = manager.load();
            let start_minimized = config.start_minimized;
            
            // Register initial global shortcut
            if let Some(ref sc) = config.global_shortcut {
                if let Ok(shortcut) = sc.to_lowercase().parse::<tauri_plugin_global_shortcut::Shortcut>() {
                    let _ = app.global_shortcut().register(shortcut);
                }
            }

            let config_clone = config.clone();
            app.manage(Mutex::new(config));
            app.manage(audio::AudioState::new());
            app.manage(downloader::DownloadState::new());

            // Spawn background thread to pre-warm audio devices and pre-decode audio files
            let app_handle_clone = app.handle().clone();
            std::thread::spawn(move || {
                if let Some(audio_state) = app_handle_clone.try_state::<audio::AudioState>() {
                    println!("Starting background audio pre-warming & caching task...");
                    
                    // 1. Pre-warm default audio playback stream
                    let _ = audio_state.get_device_handle(None);
                    
                    // 2. Pre-warm custom assigned devices and pre-decode files
                    for sound in &config_clone.sounds {
                        if let Some(ref device) = sound.output_device {
                            let _ = audio_state.get_device_handle(Some(device));
                        }
                        if let Err(e) = audio_state.get_or_cache_sound(&sound.file_path) {
                            eprintln!("Failed to pre-decode audio file {}: {}", sound.file_path, e);
                        }
                    }
                    println!("Background audio pre-warming & caching task completed successfully!");
                }
            });
            
            // Start cloud folder watcher
            let mut sync_manager = cloud::CloudSyncManager::new();
            if let Err(e) = sync_manager.start_watching(app.handle().clone()) {
                eprintln!("Failed to start cloud watcher: {}", e);
            }
            app.manage(Mutex::new(sync_manager));

            // Set main window visibility based on config
            if let Some(window) = app.get_webview_window("main") {
                if start_minimized {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            }

            // Setup system tray menu
            let show_hide_item = MenuItem::with_id(app, "show_hide", "Show/Hide Window", true, None::<&str>)?;
            let stop_all_item = MenuItem::with_id(app, "stop_all", "Stop All Sounds", true, None::<&str>)?;
            let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
            
            let tray_menu = Menu::with_items(app, &[
                &show_hide_item,
                &stop_all_item,
                &exit_item
            ])?;

            let icon_bytes = include_bytes!("../icons/32x32.png");
            let tray_icon = tauri::image::Image::from_bytes(icon_bytes)
                .map_err(|e| format!("Failed to parse embedded tray icon bytes: {}", e))?;

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(true);
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "stop_all" => {
                            let audio_state = app.state::<audio::AudioState>();
                            let audio_state = audio_state.inner();
                            if let Ok(mut sinks) = audio_state.active_sinks.lock() {
                                for sink in sinks.values() {
                                    sink.stop();
                                }
                                sinks.clear();
                            }
                        }
                        "exit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::update_config,
            audio::get_output_devices,
            audio::check_device_availability,
            audio::get_audio_peaks,
            audio::play_sound_router,
            audio::stop_sound,
            audio::stop_all_sounds,
            audio::sampler_play,
            audio::get_playing_states,
            cloud::generate_auth_url,
            cloud::exchange_code,
            cloud::cloud_authorize,
            cloud::cloud_unlink,
            cloud::cloud_sync_now,
            cloud::export_sound_pack,
            cloud::import_sound_pack,
            cloud::publish_pack,
            cloud::rate_community_pack,
            cloud::get_community_packs,
            cloud::download_and_import_community_pack,
            audio::select_audio_file,
            audio::select_image_file,
            audio::select_pack_file,
            downloader::probe_video,
            downloader::download_video,
            downloader::cancel_download,
            downloader::select_download_folder,
            downloader::select_save_file,
            downloader::select_save_dir,
            downloader::get_default_download_dir,
            downloader::cut_local_video,
            downloader::get_pending_trim_jobs,
            downloader::add_pending_trim_job,
            downloader::remove_pending_trim_job,
            downloader::get_temp_dir,
            downloader::delete_file,
            downloader::validate_media,
            downloader::move_file_atomic,
            downloader::cut_media_precise,
            updater::check_for_updates,
            updater::install_update,
            updater::get_sound_packs,
            updater::download_sound_pack,
            dependency_manager::check_dependencies,
            dependency_manager::download_dependency
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

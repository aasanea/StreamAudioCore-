use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;
use std::sync::Mutex;

fn default_filter_mode() -> String {
    "none".to_string()
}

fn default_theme() -> String {
    "dark".to_string()
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SamplerOptions {
    pub cue_start_ms: u64,
    pub cue_end_ms: u64,
    pub speed: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SoundEntry {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub file_path: String,
    pub output_device: Option<String>,
    pub volume: u32,
    pub play_mode: String, // "one-shot", "hold", "loop", "toggle"
    pub sampler_options: Option<SamplerOptions>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PadEntry {
    pub position: usize,
    pub sound_id: Option<Uuid>,
    pub color: Option<String>,
    #[serde(default)]
    pub muted: bool,
    #[serde(default)]
    pub soloed: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default = "default_filter_mode")]
    pub filter_mode: String, // "none", "lowpass", "highpass", "reverb"
    #[serde(default)]
    pub image_path: Option<String>, // new field
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SamplerGrid {
    pub columns: usize,
    pub rows: usize,
    pub pads: Vec<Option<PadEntry>>,
    #[serde(default)]
    pub page_names: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Config {
    pub version: u32,
    pub sounds: Vec<SoundEntry>,
    pub sampler_grid: SamplerGrid,
    pub cloud_provider: Option<String>,
    pub cloud_folder: String,
    pub global_volume: u32,
    pub start_minimized: bool,
    #[serde(default)]
    pub global_shortcut: Option<String>,
    #[serde(default = "default_theme")]
    pub theme: String, // "dark", "light"
}

impl Default for Config {
    fn default() -> Self {
        let mut pads = Vec::new();
        for i in 0..64 {
            pads.push(Some(PadEntry {
                position: i,
                sound_id: None,
                color: None,
                muted: false,
                soloed: false,
                locked: false,
                filter_mode: "none".to_string(),
                image_path: None,
            }));
        }
        Config {
            version: 2,
            sounds: Vec::new(),
            sampler_grid: SamplerGrid {
                columns: 4,
                rows: 4,
                pads,
                page_names: vec![
                    "الصفحة 1".to_string(),
                    "الصفحة 2".to_string(),
                    "الصفحة 3".to_string(),
                    "الصفحة 4".to_string(),
                ],
            },
            cloud_provider: None,
            cloud_folder: "/StreamAudioCore".to_string(),
            global_volume: 80,
            start_minimized: false,
            global_shortcut: Some("Ctrl+Shift+S".to_string()),
            theme: "dark".to_string(),
        }
    }
}

pub struct ConfigManager {
    pub config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("AppData/Local/StreamAudioCore"));
        
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }

        let sounds_dir = app_dir.join("sounds");
        if !sounds_dir.exists() {
            let _ = fs::create_dir_all(&sounds_dir);
        }

        let config_path = app_dir.join("config.json");
        ConfigManager { config_path }
    }

    pub fn load(&self) -> Config {
        if !self.config_path.exists() {
            let default_config = Config::default();
            let _ = self.save(&default_config);
            return default_config;
        }

        match fs::read_to_string(&self.config_path) {
            Ok(content) => {
                let mut cfg: Config = serde_json::from_str(&content).unwrap_or_else(|e| {
                    eprintln!("Failed to parse config: {}, writing default", e);
                    let default_config = Config::default();
                    let _ = self.save(&default_config);
                    default_config
                });
                
                // Ensure we have at least 64 pads (4 pages of 16)
                if cfg.sampler_grid.pads.len() < 64 {
                    let start = cfg.sampler_grid.pads.len();
                    for i in start..64 {
                        cfg.sampler_grid.pads.push(Some(PadEntry {
                            position: i,
                            sound_id: None,
                            color: None,
                            muted: false,
                            soloed: false,
                            locked: false,
                            filter_mode: "none".to_string(),
                            image_path: None,
                        }));
                    }
                    let _ = self.save(&cfg);
                }
                cfg
            }
            Err(_) => {
                let default_config = Config::default();
                let _ = self.save(&default_config);
                default_config
            }
        }
    }

    pub fn save(&self, config: &Config) -> Result<(), String> {
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
        }

        fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        
        Ok(())
    }
}

#[tauri::command]
pub fn get_config(app_handle: tauri::AppHandle) -> Result<Config, String> {
    let state = app_handle.state::<Mutex<Config>>();
    let config = state.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn update_config(config: Config, app_handle: tauri::AppHandle) -> Result<(), String> {
    // Dynamically update global shortcut if changed
    let old_shortcut = {
        let state = app_handle.state::<Mutex<Config>>();
        let mut shortcut = None;
        if let Ok(guard) = state.lock() {
            shortcut = guard.global_shortcut.clone();
        }
        shortcut
    };

    if old_shortcut != config.global_shortcut {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app_handle.global_shortcut();
        if let Some(ref old) = old_shortcut {
            if let Ok(shortcut) = old.to_lowercase().parse::<tauri_plugin_global_shortcut::Shortcut>() {
                let _ = gs.unregister(shortcut);
            }
        }
        if let Some(ref new_sc) = config.global_shortcut {
            if let Ok(shortcut) = new_sc.to_lowercase().parse::<tauri_plugin_global_shortcut::Shortcut>() {
                let _ = gs.register(shortcut);
            }
        }
    }

    let manager = ConfigManager::new(&app_handle);
    manager.save(&config)?;
    
    let state = app_handle.state::<Mutex<Config>>();
    let mut state_lock = state.lock().map_err(|e| e.to_string())?;
    *state_lock = config.clone();

    // Update active sinks' volumes live in AudioState if it exists
    if let Some(audio_state_wrapper) = app_handle.try_state::<crate::audio::AudioState>() {
        let audio_state = audio_state_wrapper.inner();
        if let Ok(mut sinks) = audio_state.active_sinks.lock() {
            sinks.retain(|_, sink| !sink.empty());
            for (sound_id_str, sink) in sinks.iter() {
                if let Ok(sound_uuid) = Uuid::parse_str(sound_id_str) {
                    if let Some(sound) = config.sounds.iter().find(|s| s.id == sound_uuid) {
                        sink.set_volume((sound.volume as f32 / 100.0) * (config.global_volume as f32 / 100.0));
                    }
                }
            }
        }
    }

    Ok(())
}

/// Public update server — served via Cloudflare Tunnel HTTPS, no client config needed.
/// Users receive updates automatically without any manual steps.
pub const UPDATE_SERVER_BASE: &str = "https://updates.aasanea.com";

/// Tauri updater manifest endpoint (referenced in tauri.conf.json as well).
pub const UPDATE_ENDPOINT: &str = "https://updates.aasanea.com/releases/latest.json";

/// Sound pack catalogue index.
pub const SOUND_PACK_INDEX_URL: &str = "https://sound-package.aasanea.com/index.json";

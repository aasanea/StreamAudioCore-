export interface SamplerOptions {
  cue_start_ms: number;
  cue_end_ms: number;
  speed: number;
}

export interface SoundEntry {
  id: string;
  code: string;
  name: string;
  file_path: string;
  output_device: string | null;
  volume: number;
  play_mode: string; // "one-shot", "hold", "loop", "toggle"
  sampler_options: SamplerOptions | null;
  tags: string[];
}

export interface PadEntry {
  position: number;
  sound_id: string | null;
  color: string | null;
  muted: boolean;
  soloed: boolean;
  locked: boolean;
  filter_mode: string; // "none", "lowpass", "highpass", "reverb"
  image_path?: string | null;
}

export interface SamplerGrid {
  columns: number;
  rows: number;
  pads: (PadEntry | null)[];
  page_names?: string[];
}

export interface Config {
  version: number;
  sounds: SoundEntry[];
  sampler_grid: SamplerGrid;
  cloud_provider: string | null;
  cloud_folder: string;
  global_volume: number;
  start_minimized: boolean;
  global_shortcut: string | null;
  theme: string; // "dark", "light"
}

export interface AudioDevice {
  id: string;
  name: string;
  is_sonar: boolean;
}

export interface CommunityPack {
  id: string;
  title: string;
  description: string;
  rating: number;
  download_url: string;
  size: string;
}

export interface SyncReport {
  status: string;
  files_synced: number;
  message: string;
}

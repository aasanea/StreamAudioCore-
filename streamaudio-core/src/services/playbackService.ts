import { invoke } from "@tauri-apps/api/core";

export async function getPlayingStates(): Promise<Record<string, boolean>> {
  return await invoke<Record<string, boolean>>("get_playing_states");
}

export async function playSound(soundId: string, deviceName: string | null): Promise<void> {
  return await invoke("play_sound_router", { soundId, deviceName });
}

export async function stopSound(soundId: string): Promise<void> {
  return await invoke("stop_sound", { soundId });
}

export async function stopAllSounds(): Promise<void> {
  return await invoke("stop_all_sounds");
}

export async function samplerPlay(options: {
  soundId: string;
  cueStartMs: number;
  cueEndMs: number;
  speed: number;
  mode: string;
  filterMode?: string;
}): Promise<void> {
  return await invoke("sampler_play", options);
}

export async function getAudioPeaks(filePath: string, numPoints: number = 40): Promise<number[]> {
  return await invoke<number[]>("get_audio_peaks", { filePath, numPoints });
}

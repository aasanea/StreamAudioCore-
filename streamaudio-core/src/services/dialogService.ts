import { invoke } from "@tauri-apps/api/core";

export async function selectAudioFile(): Promise<string | null> {
  return await invoke<string | null>("select_audio_file");
}

export async function selectPackFile(): Promise<string | null> {
  return await invoke<string | null>("select_pack_file");
}

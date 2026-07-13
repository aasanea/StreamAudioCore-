import { invoke } from "@tauri-apps/api/core";
import { AudioDevice } from "../types";

export async function getOutputDevices(): Promise<AudioDevice[]> {
  return await invoke<AudioDevice[]>("get_output_devices");
}

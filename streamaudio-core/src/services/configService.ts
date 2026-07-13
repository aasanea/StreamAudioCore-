import { invoke } from "@tauri-apps/api/core";
import { Config } from "../types";

/**
 * Loads the application configuration from the backend.
 */
export async function loadConfig(): Promise<Config> {
  return await invoke<Config>("get_config");
}

/**
 * Saves the application configuration to the backend.
 * @param config The updated configuration object.
 */
export async function saveConfig(config: Config): Promise<void> {
  return await invoke("update_config", { config });
}

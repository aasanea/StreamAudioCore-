import { invoke } from "@tauri-apps/api/core";
import { CommunityPack, SyncReport } from "../types";

export async function getCommunityPacks(): Promise<CommunityPack[]> {
  return await invoke<CommunityPack[]>("get_community_packs");
}

export async function generateAuthUrl(): Promise<string> {
  return await invoke<string>("generate_auth_url");
}

export async function exchangeCode(code: string): Promise<string> {
  return await invoke<string>("exchange_code", { code });
}

export async function cloudUnlink(provider: string = "dropbox"): Promise<string> {
  return await invoke<string>("cloud_unlink", { provider });
}

export async function cloudSyncNow(): Promise<SyncReport> {
  return await invoke<SyncReport>("cloud_sync_now");
}

export async function publishPack(title: string, description: string, soundIds: string[]): Promise<string> {
  return await invoke<string>("publish_pack", { title, description, soundIds });
}

export async function importSoundPack(packPath: string): Promise<string> {
  return await invoke<string>("import_sound_pack", { packPath });
}

export async function downloadAndImportCommunityPack(url: string): Promise<string> {
  return await invoke<string>("download_and_import_community_pack", { url });
}

export async function rateCommunityPack(packId: string, rating: number): Promise<void> {
  return await invoke("rate_community_pack", { packId, rating });
}

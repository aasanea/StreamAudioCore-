import { useState, useEffect } from "react";
import { Config, SoundEntry } from "../types";
import * as dialogService from "../services/dialogService";

export function useSoundAssigner(
  config: Config | null,
  saveConfig: (cfg: Config) => Promise<void>,
  samplerPage: number
) {
  const [assigningPadIndex, setAssigningPadIndex] = useState<number | null>(null);
  const [assigningSoundIdForPads, setAssigningSoundIdForPads] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState(0);

  // Sync modalPage with active samplerPage whenever quick assignment opens
  useEffect(() => {
    if (assigningSoundIdForPads !== null) {
      setModalPage(samplerPage);
    }
  }, [assigningSoundIdForPads, samplerPage]);

  const handleAssignLibrarySound = (position: number, soundId: string) => {
    if (!config) return;

    // Clear duplicate sound mappings elsewhere and assign to the new position
    const updatedPads = config.sampler_grid.pads.map((pad, idx) => {
      if (idx === position) {
        return {
          ...pad,
          position,
          sound_id: soundId,
          color: pad?.color || "#6c8089",
          muted: pad?.muted || false,
          soloed: pad?.soloed || false,
          locked: pad?.locked || false,
          filter_mode: pad?.filter_mode || "none",
          image_path: pad?.image_path || null
        };
      }
      if (pad?.sound_id === soundId) {
        return {
          ...pad,
          sound_id: null,
          image_path: null
        };
      }
      return pad;
    });

    saveConfig({
      ...config,
      sampler_grid: { ...config.sampler_grid, pads: updatedPads }
    });
    setAssigningPadIndex(null);
  };

  const handleBrowseFileForPad = async (position: number) => {
    if (!config) return;
    try {
      const selectedPath = await dialogService.selectAudioFile();
      if (selectedPath) {
        // Check if sound already exists in library
        const targetPath = selectedPath.trim().toLowerCase().replace(/\\/g, "/");
        const duplicateSound = config.sounds.find(s => s.file_path.trim().toLowerCase().replace(/\\/g, "/") === targetPath);
        if (duplicateSound) {
          handleAssignLibrarySound(position, duplicateSound.id);
          return;
        }

        const parts = selectedPath.split(/[/\\]/);
        const filenameWithExt = parts[parts.length - 1];
        const filename = filenameWithExt.substring(0, filenameWithExt.lastIndexOf('.')) || filenameWithExt;

        // Auto-generate unique code
        const base = filename.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10) || "sound";
        let finalCode = base;
        let suffix = 1;
        while (config.sounds.some(s => s.code === finalCode)) {
          finalCode = `${base}-${suffix}`;
          suffix += 1;
        }

        const newSound: SoundEntry = {
          id: crypto.randomUUID(),
          code: finalCode,
          name: filename,
          file_path: selectedPath,
          output_device: "default",
          volume: 85,
          play_mode: "one-shot",
          sampler_options: {
            cue_start_ms: 0,
            cue_end_ms: 0,
            speed: 1.0
          },
          tags: []
        };

        const updatedSounds = [...config.sounds, newSound];
        const updatedPads = [...config.sampler_grid.pads];

        const currentPad = config.sampler_grid.pads[position];
        updatedPads[position] = {
          position,
          sound_id: newSound.id,
          color: currentPad?.color || "#6c8089",
          muted: currentPad?.muted || false,
          soloed: currentPad?.soloed || false,
          locked: currentPad?.locked || false,
          filter_mode: currentPad?.filter_mode || "none",
          image_path: currentPad?.image_path || null
        };

        await saveConfig({
          ...config,
          sounds: updatedSounds,
          sampler_grid: { ...config.sampler_grid, pads: updatedPads }
        });

        setAssigningPadIndex(null);
      }
    } catch (err) {
      console.error("Failed to select file for pad:", err);
    }
  };

  return {
    assigningPadIndex,
    setAssigningPadIndex,
    assigningSoundIdForPads,
    setAssigningSoundIdForPads,
    modalPage,
    setModalPage,
    handleBrowseFileForPad,
    handleAssignLibrarySound
  };
}

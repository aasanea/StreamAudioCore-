import { useState, useEffect } from "react";
import { Config, PadEntry, SoundEntry } from "../types";
import * as playbackService from "../services/playbackService";

export function useSamplerGrid(
  config: Config | null,
  saveConfig: (cfg: Config) => Promise<void>,
  showAlert: (msg: string) => void,
  playingStates: Record<string, boolean>,
  stopSound: (id: string) => Promise<void>
) {
  const [samplerPage, setSamplerPage] = useState(0);
  const [editingPageIdx, setEditingPageIdx] = useState<number | null>(null);
  const [editingPageLabel, setEditingPageLabel] = useState("");

  const numPages = Math.max(4, Math.ceil((config?.sampler_grid?.pads?.length || 64) / 16));

  // Auto-scroll on page change
  useEffect(() => {
    const el = document.getElementById("sampler-grid-container");
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [samplerPage]);

  const handleDropOnPad = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    if (!config) return;

    // Check lock
    const currentPad = config.sampler_grid.pads[position];
    if (currentPad?.locked) {
      showAlert("الخلية مغلقة! يرجى إلغاء القفل للتعديل.");
      return;
    }

    const draggedId = e.dataTransfer.getData("text/plain") || (e.dataTransfer.types.includes("text/plain") && e.dataTransfer.getData("text"));
    const idToUse = draggedId || e.dataTransfer.getData("text/plain");

    if (!idToUse) return;

    // Clear duplicate sound mappings elsewhere and assign to the new position
    const updatedPads = config.sampler_grid.pads.map((pad, idx) => {
      if (idx === position) {
        return {
          ...pad,
          position,
          sound_id: idToUse,
          color: pad?.color || "#6c8089",
          muted: pad?.muted || false,
          soloed: pad?.soloed || false,
          locked: pad?.locked || false,
          filter_mode: pad?.filter_mode || "none",
          image_path: pad?.image_path || null
        };
      }
      if (pad?.sound_id === idToUse) {
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
  };

  const handleRemoveFromPad = (position: number) => {
    if (!config) return;
    const currentPad = config.sampler_grid.pads[position];
    if (currentPad?.locked) {
      showAlert("الخلية مغلقة! يرجى إلغاء القفل للإزالة.");
      return;
    }

    const updatedPads = [...config.sampler_grid.pads];
    updatedPads[position] = {
      position,
      sound_id: null,
      color: null,
      muted: false,
      soloed: false,
      locked: false,
      filter_mode: "none",
      image_path: null
    };
    saveConfig({
      ...config,
      sampler_grid: { ...config.sampler_grid, pads: updatedPads }
    });
  };

  const handleAddSamplerPage = () => {
    if (!config) return;
    const currentLength = config.sampler_grid.pads.length;
    const newPads = [...config.sampler_grid.pads];

    // Add 16 new blank pads
    for (let i = 0; i < 16; i++) {
      newPads.push({
        position: currentLength + i,
        sound_id: null,
        color: null,
        muted: false,
        soloed: false,
        locked: false,
        filter_mode: "none",
        image_path: null
      });
    }

    const currentNames = [...(config.sampler_grid.page_names || [])];
    const newPageIdx = Math.floor(currentLength / 16);
    while (currentNames.length < newPageIdx) {
      currentNames.push(`الصفحة ${currentNames.length + 1}`);
    }
    currentNames.push(`الصفحة ${newPageIdx + 1}`);

    saveConfig({
      ...config,
      sampler_grid: {
        ...config.sampler_grid,
        pads: newPads,
        page_names: currentNames
      }
    });

    // Switch active page to the newly added one
    setSamplerPage(newPageIdx);
  };

  const handleRemoveSamplerPage = (pageIndex: number) => {
    if (!config) return;
    const currentLength = config.sampler_grid.pads.length;

    if (currentLength <= 64) {
      showAlert("لا يمكن حذف صفحات إضافية، يجب أن يحتوي النظام على 4 صفحات على الأقل.");
      return;
    }

    const startIdx = pageIndex * 16;
    const endIdx = startIdx + 16;

    // Filter out pads belonging to the selected page index
    const updatedPads = config.sampler_grid.pads
      .filter((_, idx) => idx < startIdx || idx >= endIdx)
      .map((pad, idx) => {
        if (pad) {
          return {
            ...pad,
            position: idx
          };
        }
        return null;
      });

    const currentNames = [...(config.sampler_grid.page_names || [])];
    if (currentNames.length > pageIndex) {
      currentNames.splice(pageIndex, 1);
    }

    saveConfig({
      ...config,
      sampler_grid: {
        ...config.sampler_grid,
        pads: updatedPads,
        page_names: currentNames
      }
    });

    const nextActivePage = Math.max(0, pageIndex - 1);
    setSamplerPage(nextActivePage);
  };

  const handleRenamePage = (pageIndex: number, newName: string) => {
    if (!config) return;
    const currentNames = [...(config.sampler_grid.page_names || [])];

    while (currentNames.length < numPages) {
      currentNames.push(`الصفحة ${currentNames.length + 1}`);
    }

    currentNames[pageIndex] = newName.trim() || `الصفحة ${pageIndex + 1}`;

    saveConfig({
      ...config,
      sampler_grid: {
        ...config.sampler_grid,
        page_names: currentNames
      }
    });
  };

  const handlePadPress = async (pad: PadEntry, sound: SoundEntry) => {
    if (pad.muted) return; // Muted

    if (playingStates[sound.id]) {
      stopSound(sound.id);
      return;
    }

    try {
      // Stop all other playing sounds first to prevent overlap
      const activePlayingIds = Object.keys(playingStates).filter(id => playingStates[id]);
      for (const id of activePlayingIds) {
        if (id !== sound.id) {
          await stopSound(id);
        }
      }
    } catch (err) {
      console.error("Failed to stop other sounds:", err);
    }

    const cueStart = sound.sampler_options?.cue_start_ms || 0;
    const cueEnd = sound.sampler_options?.cue_end_ms || 0;
    const speed = sound.sampler_options?.speed || 1.0;
    const mode = pad.soloed ? "solo" : sound.play_mode;

    try {
      await playbackService.samplerPlay({ 
        soundId: sound.id, 
        cueStartMs: cueStart, 
        cueEndMs: cueEnd, 
        speed, 
        mode, 
        filterMode: pad.filter_mode 
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePadRelease = async (sound: SoundEntry, mode: string) => {
    if (mode === "hold") {
      stopSound(sound.id);
    }
  };

  return {
    samplerPage,
    setSamplerPage,
    editingPageIdx,
    setEditingPageIdx,
    editingPageLabel,
    setEditingPageLabel,
    numPages,
    handleDropOnPad,
    handleRemoveFromPad,
    handleAddSamplerPage,
    handleRemoveSamplerPage,
    handleRenamePage,
    handlePadPress,
    handlePadRelease
  };
}

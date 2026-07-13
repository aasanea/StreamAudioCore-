import { useState } from "react";
import { Config } from "../types";

export function usePadEditor(
  config: Config | null,
  saveConfig: (newCfg: Config) => Promise<void>
) {
  const [editingPadIndex, setEditingPadIndex] = useState<number | null>(null);
  const [padCueStart, setPadCueStart] = useState(0);
  const [padCueEnd, setPadCueEnd] = useState(0);
  const [padSpeed, setPadSpeed] = useState(1.0);
  const [padMode, setPadMode] = useState("one-shot");
  const [padColor, setPadColor] = useState("#6c8089");
  const [padFilter, setPadFilter] = useState("none");
  const [padMuted, setPadMuted] = useState(false);
  const [padSoloed, setPadSoloed] = useState(false);
  const [padLocked, setPadLocked] = useState(false);
  const [padImagePath, setPadImagePath] = useState<string | null>(null);

  const openEditPadModal = (position: number) => {
    if (!config) return;
    const pad = config.sampler_grid.pads[position];
    if (!pad || !pad.sound_id) return;

    const sound = config.sounds.find(s => s.id === pad.sound_id);
    if (!sound) return;

    setEditingPadIndex(position);
    setPadCueStart(sound.sampler_options?.cue_start_ms || 0);
    setPadCueEnd(sound.sampler_options?.cue_end_ms || 0);
    setPadSpeed(sound.sampler_options?.speed || 1.0);
    setPadMode(sound.play_mode || "one-shot");

    setPadColor(pad.color || "#6c8089");
    setPadFilter(pad.filter_mode || "none");
    setPadMuted(pad.muted || false);
    setPadSoloed(pad.soloed || false);
    setPadLocked(pad.locked || false);
    setPadImagePath(pad.image_path || null);
  };

  const savePadOptions = () => {
    if (!config || editingPadIndex === null) return;
    const pad = config.sampler_grid.pads[editingPadIndex];
    if (!pad || !pad.sound_id) return;

    // Update sound options
    const updatedSounds = config.sounds.map(s => {
      if (s.id === pad.sound_id) {
        return {
          ...s,
          play_mode: padMode,
          sampler_options: {
            cue_start_ms: padCueStart,
            cue_end_ms: padCueEnd,
            speed: padSpeed
          }
        };
      }
      return s;
    });

    // Update pad options
    const updatedPads = [...config.sampler_grid.pads];
    updatedPads[editingPadIndex] = {
      position: editingPadIndex,
      sound_id: pad.sound_id,
      color: padColor,
      muted: padMuted,
      soloed: padSoloed,
      locked: padLocked,
      filter_mode: padFilter,
      image_path: padImagePath
    };

    saveConfig({
      ...config,
      sounds: updatedSounds,
      sampler_grid: { ...config.sampler_grid, pads: updatedPads }
    });
    setEditingPadIndex(null);
  };

  return {
    // states
    editingPadIndex,
    padCueStart,
    padCueEnd,
    padSpeed,
    padMode,
    padColor,
    padFilter,
    padMuted,
    padSoloed,
    padLocked,
    padImagePath,
    // setters
    setEditingPadIndex,
    setPadCueStart,
    setPadCueEnd,
    setPadSpeed,
    setPadMode,
    setPadColor,
    setPadFilter,
    setPadMuted,
    setPadSoloed,
    setPadLocked,
    setPadImagePath,
    // orchestration
    openEditPadModal,
    savePadOptions
  };
}

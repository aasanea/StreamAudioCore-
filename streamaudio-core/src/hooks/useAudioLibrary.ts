import { useState, useRef, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Config, SoundEntry } from "../types";
import * as dialogService from "../services/dialogService";

export function useAudioLibrary(
  config: Config | null,
  saveConfig: (newCfg: Config) => Promise<void>,
  showAlert: (msg: string) => void,
  globalOutputDevice: string
) {
  const [newSoundName, setNewSoundName] = useState("");
  const [newSoundPath, setNewSoundPath] = useState("");
  const [newSoundCode, setNewSoundCode] = useState("");
  const [newSoundTags, setNewSoundTags] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingSoundId, setEditingSoundId] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState("");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (newSoundPath) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setIsPreviewPlaying(false);
    }
  }, [newSoundPath]);

  const handleBrowseFile = async () => {
    try {
      const selectedPath = await dialogService.selectAudioFile();
      if (selectedPath) {
        setNewSoundPath(selectedPath);
        const filename = selectedPath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || "";
        if (!newSoundName) {
          setNewSoundName(filename);
        }
        if (!newSoundCode) {
          const cleanCode = filename.toLowerCase().replace(/[^a-z0-9]/g, "");
          setNewSoundCode(cleanCode);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const path = (file as any).path || file.name; 
      if (path) {
        setNewSoundPath(path);
        const filename = file.name.replace(/\.[^/.]+$/, "");
        if (!newSoundName) {
          setNewSoundName(filename);
        }
        if (!newSoundCode) {
          const cleanCode = filename.toLowerCase().replace(/[^a-z0-9]/g, "");
          setNewSoundCode(cleanCode);
        }
      }
    }
  };

  const handleTogglePreview = () => {
    if (!newSoundPath) return;

    if (isPreviewPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setIsPreviewPlaying(false);
    } else {
      try {
        const assetUrl = convertFileSrc(newSoundPath);
        const audio = new Audio(assetUrl);
        audio.onended = () => {
          setIsPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        audio.onerror = () => {
          showAlert("Error playing preview");
          setIsPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        previewAudioRef.current = audio;
        audio.play();
        setIsPreviewPlaying(true);
      } catch (err) {
        console.error(err);
        showAlert("Failed to preview audio");
      }
    }
  };

  const handleAddSound = () => {
    if (!config) return;
    
    if (!newSoundName.trim()) {
      showAlert("USOOU% OO_OrO U, O O3U. O U,U.O OO O U,OU^OUS.");
      return;
    }
    if (!newSoundPath.trim()) {
      showAlert("USOOU% O OrOUSO O U.O3O O O U,U.U,U? O U,OU^OUS.");
      return;
    }

    const targetPath = newSoundPath.trim().toLowerCase().replace(/\\/g, "/");
    const duplicateSound = config.sounds.find(s => s.file_path.trim().toLowerCase().replace(/\\/g, "/") === targetPath);
    if (duplicateSound) {
      showAlert(`UOO  O U,OU^O U.U^OU^O_ U,O_USU O"O O3U. "${duplicateSound.name}" U^O OrOOO OU "${duplicateSound.code}"`);
      return;
    }

    let finalCode = newSoundCode.trim().toLowerCase();
    if (!finalCode) {
      const cleanName = newSoundName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const base = cleanName.substring(0, 10) || "sound";
      const suffix = Math.floor(1000 + Math.random() * 9000).toString(10);
      finalCode = `${base}-${suffix}`;
      
      let attempts = 0;
      while (config.sounds.some(s => s.code === finalCode) && attempts < 10) {
        const tempSuffix = Math.floor(1000 + Math.random() * 9000).toString(10);
        finalCode = `${base}-${tempSuffix}`;
        attempts += 1;
      }
    } else {
      if (config.sounds.some(s => s.code === finalCode)) {
        const base = finalCode.substring(0, 12);
        let suffixNum = 1;
        let candidate = `${base}-${suffixNum}`;
        while (config.sounds.some(s => s.code === candidate)) {
          suffixNum += 1;
          candidate = `${base}-${suffixNum}`;
        }
        finalCode = candidate;
      }
    }
    
    const tagsArr = newSoundTags
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const newSound: SoundEntry = {
      id: crypto.randomUUID(),
      code: finalCode,
      name: newSoundName.trim(),
      file_path: newSoundPath.trim(),
      output_device: globalOutputDevice,
      volume: 85,
      play_mode: "one-shot",
      sampler_options: {
        cue_start_ms: 0,
        cue_end_ms: 0,
        speed: 1.0
      },
      tags: tagsArr
    };

    saveConfig({
      ...config,
      sounds: [...config.sounds, newSound]
    });

    setNewSoundName("");
    setNewSoundPath("");
    setNewSoundCode("");
    setNewSoundTags("");
  };

  const handleDeleteSound = (id: string) => {
    if (!config) return;
    const updatedSounds = config.sounds.filter(s => s.id !== id);
    const updatedPads = config.sampler_grid.pads.map(pad => {
      if (pad && pad.sound_id === id) {
        return { ...pad, sound_id: null } as any; // Cast to bypass TS if PadEntry has position issues
      }
      return pad;
    });

    saveConfig({
      ...config,
      sounds: updatedSounds,
      sampler_grid: { ...config.sampler_grid, pads: updatedPads }
    });
  };

  const handleUpdateSoundDevice = (soundId: string, device: string) => {
    if (!config) return;
    const updatedSounds = config.sounds.map(s => {
      if (s.id === soundId) {
        return { ...s, output_device: device === "default" ? null : device };
      }
      return s;
    });
    saveConfig({ ...config, sounds: updatedSounds });
  };

  const handleUpdateSoundVolume = (soundId: string, vol: number) => {
    if (!config) return;
    const updatedSounds = config.sounds.map(s => {
      if (s.id === soundId) {
        return { ...s, volume: vol };
      }
      return s;
    });
    saveConfig({ ...config, sounds: updatedSounds });
  };

  const handleUpdateSoundCode = (soundId: string, newCode: string) => {
    if (!config) return;
    const cleanCode = newCode.trim().toLowerCase();
    if (!cleanCode) return;
    
    if (config.sounds.some(s => s.id !== soundId && s.code === cleanCode)) {
      showAlert(`O1OOO U<OO UU^O_ O U,OO'OUSU, "${cleanCode}" U.O3OOrO_U. O"O U,U?O1U, U,U.O OO OOrO.`);
      return;
    }

    const updatedSounds = config.sounds.map(s => {
      if (s.id === soundId) {
        return { ...s, code: cleanCode };
      }
      return s;
    });
    saveConfig({ ...config, sounds: updatedSounds });
    setEditingSoundId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return {
    newSoundName, setNewSoundName,
    newSoundPath, setNewSoundPath,
    newSoundCode, setNewSoundCode,
    newSoundTags, setNewSoundTags,
    copiedCode, setCopiedCode,
    editingSoundId, setEditingSoundId,
    editingCodeValue, setEditingCodeValue,
    isPreviewPlaying, setIsPreviewPlaying,
    isDraggingFile, setIsDraggingFile,

    handleBrowseFile,
    handleDragOver,
    handleDragLeave,
    handleDropFile,
    handleTogglePreview,
    handleAddSound,
    handleDeleteSound,
    handleUpdateSoundDevice,
    handleUpdateSoundVolume,
    handleUpdateSoundCode,
    copyToClipboard,
    handleDragStart
  };
}

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, Library, 
  Cloud, ArrowDownToLine, LayoutGrid, 
  RefreshCw, 
  AlertTriangle,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Config, AudioDevice } from "./types";
import { AppLayout } from './components/layout/AppLayout';
import { DownloaderTab } from "./components/DownloaderTab";
import { useAppVersion } from "./hooks/useAppVersion";
import { LibraryView } from "./features/library/LibraryView";
import { SamplerView } from "./features/sampler/SamplerView";
import { CloudView } from "./features/cloud/CloudView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { WaveformCanvas } from "./components/ui/WaveformCanvas";
import { ChannelStrip } from "./components/audio/ChannelStrip";
import { PadEditModal } from "./components/modals/PadEditModal";
import { useAudioLibrary } from "./hooks/useAudioLibrary";
import { useSamplerGrid } from "./hooks/useSamplerGrid";
import { useCloudSync } from "./hooks/useCloudSync";
import { usePadEditor } from "./hooks/usePadEditor";
import { useSoundAssigner } from "./hooks/useSoundAssigner";
import { AssignSoundModal } from "./components/modals/AssignSoundModal";
import { invoke } from '@tauri-apps/api/core';
import UpdateNotificationSystem from './components/updater/UpdateNotificationSystem';
import * as configService from "./services/configService";
import * as playbackService from "./services/playbackService";
import * as deviceService from "./services/deviceService";
import "./App.css";

// Helper components

function App() {
  const appVersion = useAppVersion();
  // State
  const [config, setConfig] = useState<Config | null>(null);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [playingStates, setPlayingStates] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"library" | "sampler" | "dashboard" | "cloud" | "downloader">("library");
  
  // Navigation sliding direction tracking
  const tabOrder = useMemo(() => ["library", "sampler", "dashboard", "cloud", "downloader"], []);
  const [prevTab, setPrevTab] = useState("library");
  
  const direction = useMemo(() => {
    const prevIdx = tabOrder.indexOf(prevTab);
    const currIdx = tabOrder.indexOf(activeTab);
    if (prevIdx === currIdx) return 0;
    return currIdx > prevIdx ? 1 : -1;
  }, [activeTab, prevTab, tabOrder]);

  useEffect(() => {
    setPrevTab(activeTab);
  }, [activeTab]);

  const pageVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 120 : dir < 0 ? -120 : 0,
    }),
    animate: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -120 : dir < 0 ? 120 : 0,
    })
  };
  
  // Library State
  const [searchQuery] = useState("");

  // State for editing trigger code

  // State for sampler page navigation, assignment, and images
  // State for quick assigning library sounds to shortcut pads
  // Drag & drop file selection states

  // Preview audio states

  // Collapsible sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Online connection status state
  const [, setIsOnline] = useState(navigator.onLine);

  // Sampler page renaming states
  // Global audio output selection states
  const [globalOutputDevice, setGlobalOutputDevice] = useState(() => localStorage.getItem("global_output_device") || "default");


  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Custom Premium Alert Modal State
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);

  const showAlert = (message: string, title: string = "تنبيه") => {
    setCustomAlert({ title, message });
  };

  // Sampler Configuration Panel
  // Cloud State
  // Publish Form
  // Theme support
  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  };

  const TABS = [
    { id: 'library', icon: Library, label: 'المكتبة الصوتية' },
    { id: 'sampler', icon: LayoutGrid, label: 'واجهة اختصار الصوتيات' },
    { id: 'dashboard', icon: Sliders, label: 'توجيه الصوت ورادار المايك' },
    { id: 'cloud', icon: Cloud, label: 'المزامنة والمجتمع' },
    { id: 'downloader', icon: ArrowDownToLine, label: 'التحميل والقص' },
  ] as const;

  // Initial Load
  useEffect(() => {
    fetchConfig();
    fetchDevices();
  }, []);

  // Silent background update check — runs 3 seconds after app launch.
  // Gives the app time to fully render before the network request.
  // If an update is found, the UpdateNotificationSystem component shows the
  // toast banner automatically via the window.__streamaudio_notify_update bridge.
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const info = await invoke<{
          available: boolean;
          current_version: string;
          latest_version: string | null;
          release_notes: string | null;
          download_size: string | null;
        }>('check_for_updates');

        if (info.available && typeof (window as any).__streamaudio_notify_update === 'function') {
          (window as any).__streamaudio_notify_update(info);
        }
      } catch {
        // Silently ignore — network may be unavailable; never surface errors to user.
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Polling playing states
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const states = await playbackService.getPlayingStates();
        setPlayingStates(prev => {
          // Simple deep equality check for Record<string, boolean>
          const prevKeys = Object.keys(prev);
          const newKeys = Object.keys(states);
          
          if (prevKeys.length !== newKeys.length) return states;
          
          for (let key of prevKeys) {
            if (prev[key] !== states[key]) return states;
          }
          
          // If strictly identical in content, return the SAME reference
          // This entirely prevents React from re-rendering
          return prev;
        });
      } catch (err) {
        console.error("Failed to poll playing states", err);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering shortcuts if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Space -> Stop All
      if (e.code === "Space") {
        e.preventDefault();
        stopAll();
      }

      // Ctrl + 1/2/3/4/5 -> Tab switching
      if (e.ctrlKey && e.key === "1") {
        e.preventDefault();
        setActiveTab("library");
      }
      if (e.ctrlKey && e.key === "2") {
        e.preventDefault();
        setActiveTab("sampler");
      }
      if (e.ctrlKey && e.key === "3") {
        e.preventDefault();
        setActiveTab("dashboard");
      }
      if (e.ctrlKey && e.key === "4") {
        e.preventDefault();
        setActiveTab("cloud");
      }
      if (e.ctrlKey && e.key === "5") {
        e.preventDefault();
        setActiveTab("downloader");
      }

      // F -> Toggle Fullscreen
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.error("Error attempting to enable fullscreen:", err);
          });
        } else {
          document.exitFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config]);

  const fetchConfig = async () => {
    try {
      const cfg = await configService.loadConfig();
      setConfig(cfg);
      applyTheme(cfg.theme);
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const devs = await deviceService.getOutputDevices();
      setDevices(devs);
    } catch (err) {
      console.error("Failed to load audio devices:", err);
    }
  };

;

  const saveConfig = async (newCfg: Config) => {
    try {
      await configService.saveConfig(newCfg);
      setConfig(newCfg);
      applyTheme(newCfg.theme);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const {
    newSoundName, setNewSoundName,
    newSoundPath, setNewSoundPath,
    newSoundTags, setNewSoundTags,
    copiedCode,
    editingSoundId, setEditingSoundId,
    editingCodeValue, setEditingCodeValue,
    isPreviewPlaying,
    isDraggingFile,
    handleBrowseFile, handleDragOver, handleDragLeave, handleDropFile,
    handleTogglePreview, handleAddSound, handleDeleteSound,
    handleUpdateSoundDevice, handleUpdateSoundVolume, handleUpdateSoundCode,
    copyToClipboard, handleDragStart
  } = useAudioLibrary(config, saveConfig, showAlert, globalOutputDevice);

;

;

;

;

;

  // Sound Management
;

;

;

;

;

  const playSound = async (soundId: string, device: string | null) => {
    try {
      // Stop all other playing sounds first to prevent overlap
      const activePlayingIds = Object.keys(playingStates).filter(id => playingStates[id]);
      for (const id of activePlayingIds) {
        if (id !== soundId) {
          await stopSound(id);
        }
      }
      await playbackService.playSound(soundId, device);
    } catch (err) {
      showAlert(`Play error: ${err}`);
    }
  };

  const handleUpdateGlobalDevice = (deviceName: string) => {
    setGlobalOutputDevice(deviceName);
    localStorage.setItem("global_output_device", deviceName);
    
    if (!config) return;
    const updatedSounds = config.sounds.map(s => ({
      ...s,
      output_device: deviceName
    }));
    
    saveConfig({
      ...config,
      sounds: updatedSounds
    });
  };

  const stopSound = async (soundId: string) => {
    try {
      await playbackService.stopSound(soundId);
    } catch (err) {
      console.error(err);
    }
  };

  const stopAll = async () => {
    try {
      await playbackService.stopAllSounds();
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and Drop
;

;

;

;

;

;

;

;

  // Sampler Playback
;

;

  // Edit Pad Options
;

;

  // Dropbox PKCE OAuth
;

;

;

;
;

;

;

;

;



  // Filtered sound list


  const {
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
  } = useSamplerGrid(config, saveConfig, showAlert, playingStates, stopSound);

  const pagesArray = Array.from({ length: numPages }, (_, i) => i);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeBtn = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    }
  }, [samplerPage]);

  const {
    dropboxCode,
    setDropboxCode,
    syncReport,
    syncing,
    communityPacks,
    loadingPacks,
    publishingPack,
    publishTitle,
    setPublishTitle,
    publishDesc,
    setPublishDesc,
    selectedSoundsForPack,
    setSelectedSoundsForPack,
    handleGetAuthCode,
    handleExchangeCode,
    handleUnlinkDropbox,
    handleSyncNow,
    handlePublishPack,
    handleRatePack,
    handleImportPack,
    handleInstallCommunityPack
  } = useCloudSync(fetchConfig, showAlert);

  const {
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
    openEditPadModal,
    savePadOptions
  } = usePadEditor(config, saveConfig);

  const {
    assigningPadIndex,
    setAssigningPadIndex,
    assigningSoundIdForPads,
    setAssigningSoundIdForPads,
    modalPage,
    setModalPage,
    handleBrowseFileForPad,
    handleAssignLibrarySound
  } = useSoundAssigner(config, saveConfig, samplerPage);

  // --- Memoized Transport Objects (Phase 4.1) ---
  const filteredSoundsMemo = useMemo(() => {
    return config?.sounds?.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [config?.sounds, searchQuery]);

  const paginationMemo = useMemo(() => ({
    page: samplerPage,
    numPages: numPages,
    setPage: setSamplerPage,
    addPage: handleAddSamplerPage,
    removePage: handleRemoveSamplerPage,
    renamePage: handleRenamePage,
    editingPageIdx,
    setEditingPageIdx,
    editingPageLabel,
    setEditingPageLabel,
    pagesArray: pagesArray
  }), [samplerPage, numPages, editingPageIdx, editingPageLabel, pagesArray, setSamplerPage, handleAddSamplerPage, handleRemoveSamplerPage, handleRenamePage]);

  const padInteractionsMemo = useMemo(() => ({
    onPress: handlePadPress,
    onRelease: handlePadRelease,
    onDrop: handleDropOnPad,
    onRemove: handleRemoveFromPad,
    onOpenEditModal: openEditPadModal,
    setAssigningPadIndex
  }), [handlePadPress, handlePadRelease, handleDropOnPad, handleRemoveFromPad, openEditPadModal, setAssigningPadIndex]);



  const padSettingsStateMemo = useMemo(() => ({
    editingPadIndex,
    padMuted,
    padSoloed,
    padLocked,
    padFilter,
    padImagePath,
    padColor,
    padCueStart,
    padCueEnd,
    padSpeed,
    padMode
  }), [editingPadIndex, padMuted, padSoloed, padLocked, padFilter, padImagePath, padColor, padCueStart, padCueEnd, padSpeed, padMode]);

  const padSettingsActionsMemo = useMemo(() => ({
    setEditingPadIndex,
    setPadMuted,
    setPadSoloed,
    setPadLocked,
    setPadFilter,
    setPadImagePath,
    setPadColor,
    setPadCueStart,
    setPadCueEnd,
    setPadSpeed,
    setPadMode,
    savePadOptions
  }), [setEditingPadIndex, setPadMuted, setPadSoloed, setPadLocked, setPadFilter, setPadImagePath, setPadColor, setPadCueStart, setPadCueEnd, setPadSpeed, setPadMode, savePadOptions]);

  const assignStateMemo = useMemo(() => ({
    assigningPadIndex,
    sounds: config?.sounds || []
  }), [assigningPadIndex, config?.sounds]);

  const assignActionsMemo = useMemo(() => ({
    handleBrowseFileForPad,
    handleAssignLibrarySound,
    setAssigningPadIndex
  }), [handleBrowseFileForPad, handleAssignLibrarySound, setAssigningPadIndex]);

  const cloudDataMemo = useMemo(() => ({
      config: config as Config,
      communityPacks,
      loadingPacks
    }), [config, communityPacks, loadingPacks]);

  const cloudActionsMemo = useMemo(() => ({
    handleRatePack,
    handleInstallCommunityPack,
    handleImportPack
  }), [handleRatePack, handleInstallCommunityPack, handleImportPack]);

  const syncStateMemo = useMemo(() => ({
    syncReport,
    syncing,
    dropboxCode,
    setDropboxCode,
    handleUnlinkDropbox,
    handleGetAuthCode,
    handleExchangeCode,
    handleSyncNow
  }), [syncReport, syncing, dropboxCode, setDropboxCode, handleUnlinkDropbox, handleGetAuthCode, handleExchangeCode, handleSyncNow]);

  const publishStateMemo = useMemo(() => ({
    publishTitle,
    setPublishTitle,
    publishDesc,
    setPublishDesc,
    selectedSoundsForPack,
    setSelectedSoundsForPack,
    publishingPack,
    handlePublishPack
  }), [publishTitle, setPublishTitle, publishDesc, setPublishDesc, selectedSoundsForPack, setSelectedSoundsForPack, publishingPack, handlePublishPack]);

    if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
          <p className="mt-4 text-zinc-400 font-medium">جاري تحميل منصة StreamAudio Core {appVersion}...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab as any} 
      isSidebarCollapsed={isSidebarCollapsed} 
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      tabs={TABS}
    >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="h-full flex-1 relative overflow-hidden"
          >
            {activeTab === "library" && (
              <div className="p-8 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <LibraryView
                  isDraggingFile={isDraggingFile}
                  newSoundName={newSoundName}
                  setNewSoundName={setNewSoundName}
                  newSoundPath={newSoundPath}
                  setNewSoundPath={setNewSoundPath}
                  newSoundTags={newSoundTags}
                  setNewSoundTags={setNewSoundTags}
                  isPreviewPlaying={isPreviewPlaying}
                  filteredSounds={filteredSoundsMemo}
                  playingStates={playingStates}
                  editingSoundId={editingSoundId}
                  setEditingSoundId={setEditingSoundId}
                  editingCodeValue={editingCodeValue}
                  setEditingCodeValue={setEditingCodeValue}
                  copiedCode={copiedCode}
                  devices={devices}
                  
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDropFile={handleDropFile}
                  handleBrowseFile={handleBrowseFile}
                  handleTogglePreview={handleTogglePreview}
                  handleAddSound={handleAddSound}
                  handleDragStart={handleDragStart}
                  handleUpdateSoundCode={handleUpdateSoundCode}
                  copyToClipboard={copyToClipboard}
                  handleUpdateSoundDevice={handleUpdateSoundDevice}
                  handleUpdateSoundVolume={handleUpdateSoundVolume}
                  handleDeleteSound={handleDeleteSound}
                  setAssigningSoundIdForPads={setAssigningSoundIdForPads}
                  playSound={playSound}
                  stopSound={stopSound}
                  WaveformCanvas={WaveformCanvas}
                  ChannelStrip={ChannelStrip}
                />
              </div>
            )}
            
            {activeTab === "sampler" && (
              <div className="p-5 md:p-6 h-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
                <SamplerView
                  config={config}
                  playingStates={playingStates}
                  pagination={paginationMemo}
                  padInteractions={padInteractionsMemo}
                  WaveformCanvas={WaveformCanvas}
                />

                {/* Pad Settings Context Modal */}
                <PadEditModal
                  padSettingsState={padSettingsStateMemo}
                  padSettingsActions={padSettingsActionsMemo}
                />

                {/* Assign Sound Modal */}
                <AssignSoundModal
                  assignState={assignStateMemo}
                  assignActions={assignActionsMemo}
                />
              </div>
            )}

            {activeTab === "cloud" && (
              <div className="p-8 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <CloudView 
                  cloudData={cloudDataMemo}
                  cloudActions={cloudActionsMemo}
                  syncState={syncStateMemo}
                  publishState={publishStateMemo}
                />
              </div>
            )}
            
            {activeTab === "downloader" && (
              <div className="h-full flex overflow-hidden">
                <DownloaderTab
                  onDownloadComplete={(filePath: string, title: string) => {
                    if (!config) return;
                    // Build a unique code
                    const cleanName = title.toLowerCase().replace(/[^a-z0-9]/g, "");
                    const base = cleanName.substring(0, 10) || "sound";
                    let finalCode = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
                    while (config.sounds.some(s => s.code === finalCode)) {
                      finalCode = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
                    }
                    // Avoid duplicating same file path
                    const normPath = filePath.trim().toLowerCase().replace(/\\/g, "/");
                    const existing = config.sounds.find(
                      s => s.file_path.trim().toLowerCase().replace(/\\/g, "/") === normPath
                    );
                    const soundId = existing?.id ?? crypto.randomUUID();
                    if (!existing) {
                      const newSound = {
                        id: soundId,
                        code: finalCode,
                        name: title.trim(),
                        file_path: filePath.trim(),
                        output_device: null as string | null,
                        volume: 85,
                        play_mode: "one-shot",
                        sampler_options: { cue_start_ms: 0, cue_end_ms: 0, speed: 1.0 },
                        tags: [] as string[],
                      };
                      saveConfig({ ...config, sounds: [...config.sounds, newSound] });
                    }
                    // Open the Shortcuts Terminal modal (no tab switch needed)
                    setAssigningSoundIdForPads(soundId);
                    setModalPage(0);
                  }}
                />
              </div>
            )}
            
            {activeTab === "dashboard" && (
              <div className="h-full flex flex-col overflow-y-auto custom-scrollbar">
                <DashboardView
                  devices={devices}
                  globalOutputDevice={globalOutputDevice}
                  onDeviceChange={handleUpdateGlobalDevice}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      {/* ── Shortcuts Terminal Active Modal ──────────────────────────── */}
      <AnimatePresence>
        {assigningSoundIdForPads !== null && (() => {
          const sound = config?.sounds.find(s => s.id === assigningSoundIdForPads);
          if (!sound) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="w-full max-w-lg flex flex-col gap-0 rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(10,13,15,0.97)",
                  border: "1px solid rgba(108,128,137,0.2)",
                  boxShadow: "0 0 0 1px rgba(108,128,137,0.08), 0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(108,128,137,0.06)",
                }}
              >
                {/* Terminal header bar */}
                <div className="flex items-center justify-between px-5 py-3.5"
                  style={{ background: "rgba(15,20,23,0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <button
                    onClick={() => setAssigningSoundIdForPads(null)}
                    className="w-3 h-3 rounded-full cursor-pointer transition-opacity hover:opacity-70"
                    style={{ background: "#ff5f57" }}
                    title="إغلاق"
                  />
                  <div className="flex items-center gap-2">
                    {/* Blinking green dot */}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#4ade80" }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22c55e" }} />
                    </span>
                    <span className="text-[11px] font-mono font-bold tracking-widest" style={{ color: "#6c8089" }}>
                      SHORTCUTS TERMINAL ACTIVE
                    </span>
                  </div>
                  <div className="w-3" />
                </div>

                {/* Sound chip */}
                <div className="px-5 pt-4 pb-2 flex items-center gap-3" dir="rtl">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ background: "rgba(108,128,137,0.1)", border: "1px solid rgba(108,128,137,0.2)" }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#6c8089" }} />
                    <span className="text-[11px] font-semibold truncate max-w-[240px]" style={{ color: "#8ba2ad" }}>
                      {sound.name}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: "#3a4a50" }}>اختر خلية للتعيين</span>
                </div>

                {/* Pad grid */}
                <div className="p-4">
                  <div className="grid grid-cols-4 gap-2">
                    {config?.sampler_grid.pads
                      .slice(modalPage * 16, (modalPage + 1) * 16)
                      .map((pad, idxOnPage) => {
                        const idx = modalPage * 16 + idxOnPage;
                        const assignedSound = pad?.sound_id
                          ? config.sounds.find(s => s.id === pad.sound_id)
                          : null;
                        const isEmpty = !assignedSound;

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              handleAssignLibrarySound(idx, sound.id);
                              setAssigningSoundIdForPads(null);
                            }}
                            className="relative aspect-square rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all duration-150 group cursor-pointer"
                            style={{
                              background: isEmpty
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(108,128,137,0.08)",
                              border: isEmpty
                                ? "1px dashed rgba(255,255,255,0.07)"
                                : "1px solid rgba(108,128,137,0.2)",
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.background = isEmpty
                                ? "rgba(108,128,137,0.1)"
                                : "rgba(180,60,60,0.12)";
                              (e.currentTarget as HTMLElement).style.border = isEmpty
                                ? "1px solid rgba(108,128,137,0.4)"
                                : "1px solid rgba(200,80,80,0.3)";
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = isEmpty
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(108,128,137,0.08)";
                              (e.currentTarget as HTMLElement).style.border = isEmpty
                                ? "1px dashed rgba(255,255,255,0.07)"
                                : "1px solid rgba(108,128,137,0.2)";
                            }}
                          >
                            {isEmpty ? (
                              <>
                                <Plus
                                  className="h-4 w-4 mb-0.5 transition-transform group-hover:scale-110"
                                  style={{ color: "rgba(108,128,137,0.4)" }}
                                />
                                <span className="text-[8px] font-mono" style={{ color: "rgba(108,128,137,0.3)" }}>
                                  {idxOnPage + 1}
                                </span>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center px-1 w-full">
                                <span className="text-[7px] font-mono mb-0.5" style={{ color: "#3a4a50" }}>{idxOnPage + 1}</span>
                                <span className="text-[9px] font-bold truncate w-full text-center leading-tight"
                                  style={{ color: "#5a7078" }}>
                                  {assignedSound.name}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Page selector + close */}
                <div className="flex items-center justify-between px-5 pb-3">
                  {/* Page dots */}
                  <div className="flex items-center gap-2">
                    {pagesArray.map(p => (
                      <button
                        key={p}
                        onClick={() => setModalPage(p)}
                        className="transition-all cursor-pointer rounded-full"
                        style={{
                          width: modalPage === p ? "20px" : "6px",
                          height: "6px",
                          background: modalPage === p ? "#6c8089" : "rgba(255,255,255,0.1)",
                        }}
                        title={`الصفحة ${p + 1}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "#2a3a40" }}>
                    PAGE {modalPage + 1} / {numPages}
                  </span>
                </div>

                {/* Skip shortcut assignment button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setAssigningSoundIdForPads(null)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "#3a4a50",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLElement).style.color = "#5a6a70";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                      (e.currentTarget as HTMLElement).style.color = "#3a4a50";
                    }}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4.5L10.5 7 8 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    تحميل دون حفظ كـ اختصار
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Custom Premium Alert Dialog */}
      <AnimatePresence>
        {customAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card w-full max-w-sm rounded-3xl p-6 border border-border-main flex flex-col gap-5 shadow-2xl bg-surface text-center"
              dir="rtl"
            >
              {/* Warning/Alert Icon */}
              <div className="mx-auto w-12 h-12 rounded-full bg-[#cfac7c]/10 border border-[#cfac7c]/30 flex items-center justify-center text-[#cfac7c] animate-pulse">
                <AlertTriangle size={24} />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-text-main font-semibold">
                  {customAlert.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {customAlert.message}
                </p>
              </div>

              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setCustomAlert(null)}
                  className="bg-neon-cyan text-white font-bold px-8 py-2 rounded-xl text-xs hover:bg-[#6c8089]/90 transition shadow-glow cursor-pointer"
                >
                  موافق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto-update notification: toast + modal — mounts at root, zero z-index conflict */}
      <UpdateNotificationSystem />

    </AppLayout>
  );
}

export default App;






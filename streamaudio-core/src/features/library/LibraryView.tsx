import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Folder, Play, Square, Check, X, Copy, Pencil, Trash2, Grid } from "lucide-react";
import { SoundEntry, AudioDevice } from "../../types";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Typography } from "../../components/ui/Typography";
import { Tooltip } from "../../components/ui/Tooltip";
import { useLanguage } from "../../i18n";

export interface LibraryViewProps {
  isDraggingFile: boolean;
  newSoundName: string;
  setNewSoundName: (val: string) => void;
  newSoundPath: string;
  setNewSoundPath: (val: string) => void;
  newSoundTags: string;
  setNewSoundTags: (val: string) => void;
  isPreviewPlaying: boolean;
  filteredSounds: SoundEntry[];
  playingStates: Record<string, boolean>;
  editingSoundId: string | null;
  setEditingSoundId: (val: string | null) => void;
  editingCodeValue: string;
  setEditingCodeValue: (val: string) => void;
  copiedCode: string | null;
  devices: AudioDevice[];
  
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDropFile: (e: React.DragEvent) => void;
  handleBrowseFile: () => void;
  handleTogglePreview: () => void;
  handleAddSound: () => void;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleUpdateSoundCode: (id: string, code: string) => void;
  copyToClipboard: (code: string) => void;
  handleUpdateSoundDevice: (id: string, device: string) => void;
  handleUpdateSoundVolume: (id: string, vol: number) => void;
  handleDeleteSound: (id: string) => void;
  setAssigningSoundIdForPads: (id: string | null) => void;
  playSound: (id: string, device: string | null) => void;
  stopSound: (id: string) => void;

  WaveformCanvas: React.ComponentType<{ filePath: string, color: string, isPlaying: boolean }>;
  ChannelStrip: React.ComponentType<{ 
    sound: SoundEntry, 
    devices: AudioDevice[], 
    isPlaying: boolean, 
    onDeviceChange: (id: string, device: string) => void,
    onVolumeChange: (id: string, vol: number) => void
  }>;
}

export const LibraryView: React.FC<LibraryViewProps> = React.memo(({
  isDraggingFile,
  newSoundName,
  setNewSoundName,
  newSoundPath,
  setNewSoundPath,
  newSoundTags,
  setNewSoundTags,
  isPreviewPlaying,
  filteredSounds,
  playingStates,
  editingSoundId,
  setEditingSoundId,
  editingCodeValue,
  setEditingCodeValue,
  copiedCode,
  devices,
  handleDragOver,
  handleDragLeave,
  handleDropFile,
  handleBrowseFile,
  handleTogglePreview,
  handleAddSound,
  handleDragStart,
  handleUpdateSoundCode,
  copyToClipboard,
  handleUpdateSoundDevice,
  handleUpdateSoundVolume,
  handleDeleteSound,
  setAssigningSoundIdForPads,
  playSound,
  stopSound,
  WaveformCanvas,
  ChannelStrip
}) => {
  const { t } = useLanguage();

  return (
    <motion.div 
      key="library"
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="p-8 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar"
    >
      <div className="flex justify-center w-full">
        {/* Add Sound Form */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropFile}
          className="w-full max-w-4xl relative"
        >
          <GlassPanel 
            intensity={isDraggingFile ? "high" : "medium"} 
            className={`p-8 transition-all duration-300 ${isDraggingFile ? "border-brand-700 shadow-[0_0_30px_rgba(34,211,238,0.2)] scale-[1.02]" : ""}`}
          >
            {isDraggingFile && (
              <div className="absolute inset-0 bg-brand-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-brand-700 z-50 pointer-events-none">
                <Upload className="h-12 w-12 text-brand-700 animate-bounce mb-3" />
                <Typography variant="h3" color="accent">{t('lib_drag_drop')}</Typography>
              </div>
            )}

            <Typography variant="h2" color="primary" className="mb-8">{t('lib_add_new')}</Typography>
            
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <input 
                    type="text" 
                    placeholder={t('lib_name_placeholder')}
                    value={newSoundName}
                    onChange={(e) => setNewSoundName(e.target.value)}
                    className="w-full bg-brand-500/20 border border-brand-500/30 hover:border-brand-500/50 focus:border-brand-700/50 focus:bg-brand-500/30 rounded-xl px-5 py-3.5 text-right text-brand-100 outline-none transition-all duration-200" 
                    dir="rtl" 
                  />
                </div>
                
                <div 
                  className="flex gap-2 items-center bg-brand-500/20 border border-dashed border-brand-500/30 hover:border-brand-700/50 rounded-xl px-2 py-1.5 focus-within:border-brand-700/50 focus-within:bg-white/10 transition-all duration-200 cursor-text group h-[52px]"
                  title={t('lib_browse_title')}
                >
                  <IconButton
                    icon={<Folder size={18} />}
                    variant="ghost"
                    onClick={handleBrowseFile}
                    title={t('lib_browse')}
                  />
                  {newSoundPath && (
                    <IconButton
                      icon={isPreviewPlaying ? <Square size={16} className="fill-red-400/20" /> : <Play size={16} className="fill-brand-700/20" />}
                      variant={isPreviewPlaying ? "danger" : "ghost"}
                      onClick={handleTogglePreview}
                      title={isPreviewPlaying ? t('lib_stop_preview') : t('lib_play_preview')}
                    />
                  )}
                  <input 
                    type="text" 
                    placeholder={t('lib_path_placeholder')} 
                    value={newSoundPath}
                    onChange={(e) => setNewSoundPath(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-right text-brand-100 focus:outline-none py-2 px-2 text-sm" 
                    dir="rtl" 
                  />
                </div>
                
                <div className="h-[52px]">
                  <input 
                    type="text" 
                    placeholder={t('lib_tags_placeholder')} 
                    value={newSoundTags}
                    onChange={(e) => setNewSoundTags(e.target.value)}
                    className="w-full h-full bg-brand-500/20 border border-brand-500/30 hover:border-brand-500/50 focus:border-brand-700/50 focus:bg-brand-500/30 rounded-xl px-5 py-3 text-right text-brand-100 outline-none transition-all duration-200" 
                    dir="rtl" 
                  />
                </div>
              </div>
              
              <div className="flex justify-start mt-2">
                <Button variant="primary" onClick={handleAddSound} className="px-10">
                  {t('lib_add_button')}
                </Button>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Grid soundboards cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredSounds.map((sound) => {
            const isPlaying = playingStates[sound.id];
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={sound.id}
                draggable
                onDragStart={(e) => handleDragStart(e as any, sound.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                <GlassPanel 
                  intensity={isPlaying ? "high" : "low"}
                    className={`relative p-6 flex flex-col gap-5 h-full transition-all duration-300 transform overflow-hidden ${
                      isPlaying 
                        ? "border-brand-700/60 shadow-[0_0_25px_rgba(128,170,160,0.15)] ring-1 ring-brand-700/20 bg-brand-500/10" 
                        : "bg-brand-500/5 border-brand-500/10 hover:-translate-y-1 hover:scale-[1.02] hover:border-brand-500/30 shadow-lg hover:shadow-xl hover:bg-brand-500/10"
                    }`}
                  >
                    {/* Background Waveform Preview */}
                  <WaveformCanvas filePath={sound.file_path} color={isPlaying ? "#22C55E" : "#4b5563"} isPlaying={isPlaying} />

                  {/* Header: Name and code */}
                  <div className="flex flex-row-reverse items-start justify-between w-full relative z-10 gap-4">
                    {editingSoundId === sound.id ? (
                      <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md border border-brand-500/30 rounded-lg p-1" dir="ltr">
                        <input 
                          type="text"
                          value={editingCodeValue}
                          onChange={(e) => setEditingCodeValue(e.target.value)}
                          className="bg-transparent text-sm font-mono text-brand-300 focus:outline-none w-20 px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateSoundCode(sound.id, editingCodeValue);
                              setEditingSoundId(null);
                            } else if (e.key === "Escape") {
                              setEditingSoundId(null);
                            }
                          }}
                        />
                        <IconButton
                          icon={<Check size={14} />}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleUpdateSoundCode(sound.id, editingCodeValue);
                            setEditingSoundId(null);
                          }}
                          className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                        />
                        <IconButton
                          icon={<X size={14} />}
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSoundId(null)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyToClipboard(sound.code)}
                          className="flex items-center gap-2 rounded-lg bg-brand-500/20 border border-brand-500/30 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-white/10 hover:text-brand-100 transition-all duration-200"
                          title={t('lib_copy_code')}
                        >
                          {copiedCode === sound.code ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-brand-700" />}
                          {sound.code}
                        </button>
                        <Tooltip content={t('lib_edit_data')} position="top">
                          <IconButton
                            icon={<Pencil size={14} />}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSoundId(sound.id);
                              setEditingCodeValue(sound.code);
                            }}
                          />
                        </Tooltip>
                      </div>
                    )}
                    
                    <div className="text-right flex-1 min-w-0" dir="rtl">
                      <Tooltip content={sound.name} position="top" delay={400} className="w-full text-right block">
                        <Typography variant="subtitle" className="truncate mb-0.5 block w-full">{sound.name}</Typography>
                      </Tooltip>
                      <Tooltip content={sound.file_path} position="bottom" delay={400} className="w-full text-right block">
                        <span className="text-[10px] text-zinc-500 block truncate font-mono w-full" dir="ltr">
                          {sound.file_path.split("\\").pop() || sound.file_path.split("/").pop()}
                        </span>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Tags */}
                  {sound.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end relative z-10">
                      {sound.tags.map((t, idx) => (
                        <span key={idx} className="bg-brand-500/10 text-brand-300 border border-brand-500/20 px-2.5 py-0.5 rounded-md text-[11px] font-medium tracking-wide">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Channel strip */}
                  <div className="relative z-10 mt-auto pt-2">
                    <ChannelStrip 
                      sound={sound}
                      devices={devices}
                      isPlaying={isPlaying}
                      onDeviceChange={handleUpdateSoundDevice}
                      onVolumeChange={handleUpdateSoundVolume}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row-reverse items-center justify-between gap-3 mt-4 relative z-10 pt-4 border-t border-white/5 group">
                    <Tooltip content={t('lib_delete_sound')} position="top">
                      <IconButton
                        icon={<Trash2 size={16} />}
                        variant="danger"
                        onClick={() => handleDeleteSound(sound.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      />
                    </Tooltip>

                    <Tooltip content={t('lib_add_to_pad')} position="top">
                      <IconButton
                        icon={<Grid size={16} />}
                        variant="ghost"
                        onClick={() => setAssigningSoundIdForPads(sound.id)}
                        className="hover:text-brand-700 hover:bg-brand-700/10 active:scale-95 transition-transform"
                      />
                    </Tooltip>

                    <Tooltip content={isPlaying ? t('lib_stop') : t('lib_play')} position="top">
                      <button
                        onClick={() => isPlaying ? stopSound(sound.id) : playSound(sound.id, sound.output_device)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 active:scale-95 shadow-md ${
                          isPlaying 
                            ? "bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]" 
                            : "bg-brand-500/20 text-brand-700 border border-brand-500/50 hover:bg-brand-500/30 hover:text-brand-300"
                        }`}
                      >
                        {isPlaying ? <Square size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-1" />}
                      </button>
                    </Tooltip>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredSounds.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-brand-500/20 flex items-center justify-center">
            <Folder size={40} className="text-zinc-600" />
          </div>
          <Typography variant="h3" color="muted">{t('lib_empty_title')}</Typography>
          <Typography variant="caption" color="muted" className="mt-2 max-w-sm">{t('lib_empty_desc')}</Typography>
        </div>
      )}
    </motion.div>
  );
});

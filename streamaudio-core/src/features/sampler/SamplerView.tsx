import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Plus, Trash2, VolumeX, Lock } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Config, SoundEntry, PadEntry } from '../../types';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { IconButton } from '../../components/ui/IconButton';
import { Typography } from '../../components/ui/Typography';

export interface PaginationState {
  page: number;
  numPages: number;
  setPage: (p: number) => void;
  addPage: () => void;
  removePage: (p: number) => void;
  renamePage: (p: number, label: string) => void;
  editingPageIdx: number | null;
  setEditingPageIdx: (idx: number | null) => void;
  editingPageLabel: string;
  setEditingPageLabel: (label: string) => void;
  pagesArray: number[];
}

// Perimeter border progress tracker component
const PadBorderProgress = React.memo(({ 
  filePath, 
  speed, 
  padColor 
}: { 
  filePath: string; 
  speed: number; 
  padColor: string; 
}) => {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const url = convertFileSrc(filePath);
    const audio = new Audio(url);
    const onLoad = () => {
      if (active) {
        setDuration(audio.duration);
      }
    };
    audio.addEventListener("loadedmetadata", onLoad);
    return () => {
      active = false;
      audio.removeEventListener("loadedmetadata", onLoad);
    };
  }, [filePath]);

  if (!duration) return null;

  const playDuration = duration / speed;

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-20" 
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <motion.rect
        x="1.5"
        y="1.5"
        width="97"
        height="97"
        rx="10"
        fill="none"
        stroke={padColor}
        strokeWidth="3"
        pathLength="100"
        initial={{ strokeDashoffset: 100 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: playDuration, ease: "linear" }}
        strokeDasharray="100"
        style={{ 
          transform: "rotate(-90deg)", 
          transformOrigin: "center",
          filter: `drop-shadow(0 0 3px ${padColor})`,
          willChange: "stroke-dashoffset"
        }}
      />
    </svg>
  );
});

PadBorderProgress.displayName = "PadBorderProgress";

export interface PadInteractions {
  onPress: (pad: PadEntry, sound: SoundEntry) => void;
  onRelease: (sound: SoundEntry, mode: string) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onRemove: (idx: number) => void;
  onOpenEditModal: (idx: number) => void;
  setAssigningPadIndex: (idx: number) => void;
}

export interface SamplerViewProps {
  config: Config;
  playingStates: Record<string, boolean>;
  pagination: PaginationState;
  padInteractions: PadInteractions;
  WaveformCanvas: React.ComponentType<{ filePath: string, color: string, isPlaying: boolean }>;
}

const gridContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1
    }
  }
};

const padItemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 35
    }
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: {
      duration: 0.1
    }
  }
};

export const SamplerView: React.FC<SamplerViewProps> = React.memo(({
  config,
  playingStates,
  pagination,
  padInteractions,
  WaveformCanvas
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    page: samplerPage,
    numPages,
    setPage: setSamplerPage,
    addPage: handleAddSamplerPage,
    removePage: handleRemoveSamplerPage,
    renamePage: handleRenamePage,
    editingPageIdx,
    setEditingPageIdx,
    editingPageLabel,
    setEditingPageLabel,
    pagesArray
  } = pagination;



  return (
    <motion.div 
      key="sampler"
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="h-full flex flex-col overflow-hidden px-8 py-6 gap-4 custom-scrollbar"
    >
      <div className="flex justify-between items-center w-full pb-2 mb-2">
        <div className="w-full flex justify-between items-center text-right" dir="rtl">
          <div className="flex flex-col flex-shrink-0">
            <Typography variant="subtitle" color="accent" className="flex items-center gap-2">
              التحكم السريع بالاختصارات 
              <span dir="ltr" className="text-[10px] text-ocean-500 font-mono tracking-widest bg-ocean-500/10 px-1.5 py-0.5 rounded border border-ocean-500/20">LIVE MODE</span>
            </Typography>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        {/* Console Container */}
        <GlassPanel intensity="medium" className="w-full max-w-[880px] p-6 flex flex-col relative border-ocean-500/10 shadow-2xl overflow-visible">
          
          {/* Page Navigation inside panel */}
          <div className="flex items-center justify-between w-full pb-4 border-b border-white/5 mb-4 gap-2">
            {/* Left Scroll Chevron */}
            <IconButton
              icon={<ChevronRight size={16} />}
              variant="ghost"
              size="sm"
              onClick={() => scrollContainerRef.current?.scrollBy({ left: -100, behavior: "smooth" })}
              title="التمرير لليمين"
              className="hover:text-ocean-400 hover:bg-ocean-400/10"
            />

            {/* Scrollable Container with Fade Overlays */}
            <div className="relative flex-1 overflow-hidden">
              {/* Right Fade */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-950/80 to-transparent pointer-events-none z-10" />
              {/* Left Fade */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-zinc-950/80 to-transparent pointer-events-none z-10" />

              <div 
                ref={scrollContainerRef}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-4 max-w-full scroll-smooth" 
                style={{ direction: "rtl" }}
              >
                {pagesArray.map((pageIndex) => {
                  const isPageActive = samplerPage === pageIndex;
                  const pageName = config.sampler_grid.page_names?.[pageIndex] || `الصفحة ${pageIndex + 1}`;
                  return (
                    <div key={pageIndex} className="flex-shrink-0">
                      {editingPageIdx === pageIndex ? (
                        <input 
                          type="text"
                          value={editingPageLabel}
                          onChange={(e) => setEditingPageLabel(e.target.value)}
                          onBlur={() => {
                            handleRenamePage(pageIndex, editingPageLabel);
                            setEditingPageIdx(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenamePage(pageIndex, editingPageLabel);
                              setEditingPageIdx(null);
                            } else if (e.key === "Escape") {
                              setEditingPageIdx(null);
                            }
                          }}
                          className="bg-black/50 text-ocean-300 font-bold px-3 py-1.5 text-center text-xs rounded-xl border border-ocean-400/50 outline-none w-24"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setSamplerPage(pageIndex)}
                          onDoubleClick={() => {
                            setEditingPageIdx(pageIndex);
                            setEditingPageLabel(pageName);
                          }}
                          data-active={isPageActive}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                            isPageActive
                              ? "bg-ocean-500/20 text-ocean-300 border-ocean-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                              : "bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 hover:border-white/10"
                          } cursor-pointer`}
                          title="انقر لتصفح الصفحة، أو انقر نقراً مزدوجاً لتعديل اسمها"
                        >
                          {pageName}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Scroll Chevron */}
            <IconButton
              icon={<ChevronLeft size={16} />}
              variant="ghost"
              size="sm"
              onClick={() => scrollContainerRef.current?.scrollBy({ left: 100, behavior: "smooth" })}
              title="التمرير لليسار"
              className="mr-1 hover:text-ocean-400 hover:bg-ocean-400/10"
            />
            
            {/* Control buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 border-r border-white/10 pr-3 mr-3">
              {/* Plus button to add a new page */}
              <IconButton
                icon={<Plus size={16} />}
                variant="secondary"
                size="sm"
                onClick={handleAddSamplerPage}
                title="إضافة صفحة جديدة"
              />
              {/* Delete active page button */}
              {numPages > 4 && (
                <IconButton
                  icon={<Trash2 size={16} />}
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemoveSamplerPage(samplerPage)}
                  title="حذف الصفحة الحالية"
                />
              )}
            </div>
          </div>

          {/* Top status light bar */}
          <div className="w-full flex items-center justify-between px-3 pb-3 border-b border-white/5 mb-4" dir="rtl">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse" />
              <span className="text-[11px] text-zinc-400 font-mono tracking-widest font-bold uppercase">Shortcuts Terminal Active</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-ocean-400 font-mono tracking-widest font-bold uppercase">Page {samplerPage + 1} / {numPages}</span>
              <div className="h-2 w-20 bg-white/5 rounded-full overflow-hidden border border-white/10 relative shadow-inner">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-ocean-400 transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" 
                  style={{ width: `${((samplerPage + 1) / numPages) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={samplerPage}
              variants={gridContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="grid grid-cols-8 gap-3 w-full relative z-10"
            >
              {config.sampler_grid.pads.slice(samplerPage * 16, (samplerPage + 1) * 16).map((pad, idxOnPage) => {
                const idx = samplerPage * 16 + idxOnPage;
                const sound = pad?.sound_id ? config.sounds.find(s => s.id === pad.sound_id) : null;
                const isPlaying = sound ? playingStates[sound.id] : false;
                const padColor = pad?.color || "#22C55E";

                return (
                  <motion.button
                    key={idx}
                    variants={padItemVariants}
                    whileHover={!pad?.locked ? { scale: 1.04 } : undefined}
                    whileTap={!pad?.locked ? { scale: 0.95 } : undefined}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => padInteractions.onDrop(e, idx)}
                    onClick={() => {
                      if (!sound) {
                        padInteractions.setAssigningPadIndex(idx);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (sound) padInteractions.onOpenEditModal(idx);
                    }}
                    onPointerDown={() => {
                      if (sound && pad) padInteractions.onPress(pad, sound);
                    }}
                    onPointerUp={() => {
                      if (sound) padInteractions.onRelease(sound, sound.play_mode);
                    }}
                    className={`
                      relative rounded-2xl border flex flex-col justify-end p-3 overflow-hidden transition-all duration-300 aspect-[6/5] group
                      ${isPlaying ? 'border-opacity-100 shadow-[0_0_20px_rgba(var(--pad-color-rgb),0.5)] z-20 scale-[1.02]' : 'border-opacity-20'}
                      ${sound ? 'bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.08] cursor-pointer' : 'bg-black/20 border-white/10 border-dashed cursor-pointer hover:border-ocean-500/50 hover:bg-ocean-500/5'}
                    `}
                    style={{
                      borderColor: isPlaying ? padColor : (sound ? 'rgba(255,255,255,0.1)' : ''),
                      '--pad-color-rgb': isPlaying ? '56,189,248' : '255,255,255',
                      backgroundImage: pad?.image_path 
                        ? `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.8)), url(${convertFileSrc(pad.image_path.replace(/\\/g, "/"))})` 
                        : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    } as any}
                  >
                    {/* Perimeter Progress bar */}
                    {isPlaying && sound && (
                      <PadBorderProgress 
                        filePath={sound.file_path}
                        speed={sound.sampler_options?.speed || 1.0}
                        padColor={padColor}
                      />
                    )}

                    {/* Pad Glow Background */}
                    <div 
                      className={`absolute inset-0 opacity-10 transition-opacity duration-300 ${isPlaying ? 'opacity-40' : 'group-hover:opacity-20'}`}
                      style={{ background: sound ? `radial-gradient(circle at center, ${padColor} 0%, transparent 70%)` : 'none' }}
                    />

                    {sound && pad ? (
                      <>
                        {/* Waves background */}
                        <div className="absolute inset-x-2 inset-y-4 opacity-50 z-0 pointer-events-none">
                          <WaveformCanvas filePath={sound.file_path} color={isPlaying ? "#ffffff" : padColor} isPlaying={isPlaying} />
                        </div>

                        {/* Pad Mode / Filter status indicators */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1 z-10">
                          {pad.muted && <VolumeX className="h-3.5 w-3.5 text-red-500 animate-pulse drop-shadow-md" />}
                          {pad.soloed && <span className="text-[9px] bg-amber-500 text-black font-black px-1.5 py-0.5 rounded shadow-sm tracking-wide">SOLO</span>}
                          {pad.filter_mode !== "none" && (
                            <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-1.5 py-0.5 rounded font-mono uppercase shadow-sm">
                              {pad.filter_mode}
                            </span>
                          )}
                        </div>

                        {/* Lock and remove icons */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40 backdrop-blur-md rounded-lg p-1 border border-white/10">
                          {pad.locked ? (
                            <Lock className="h-3.5 w-3.5 text-zinc-400" />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                padInteractions.onRemove(idx);
                              }}
                              className="text-zinc-400 hover:text-red-400 transition cursor-pointer"
                              title="إزالة الصوت"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Text label */}
                        <span className="relative z-10 text-[11px] font-bold text-center w-full truncate mt-auto drop-shadow-lg text-white select-none pointer-events-none bg-black/20 backdrop-blur-sm rounded-md px-1 py-0.5">
                          {sound.name}
                        </span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-ocean-400 transition-colors pointer-events-none group-hover:scale-105 duration-200">
                        <Plus className="h-6 w-6 stroke-[1.5]" />
                        <span className="text-[10px] font-semibold tracking-wider font-mono uppercase">Assign</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>


        </GlassPanel>
      </div>
    </motion.div>
  );
});

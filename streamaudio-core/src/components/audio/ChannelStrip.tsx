import { useState, useEffect } from 'react';
import { ChevronDown, Volume2 } from 'lucide-react';
import { SoundEntry, AudioDevice } from '../../types';

const SHOW_PLAYBACK_SELECTOR = false;
const SHOW_VOLUME_SLIDER = false;

// Pulse VU Meter & Mixer Strip
export const ChannelStrip = ({ 
  sound, 
  devices, 
  isPlaying, 
  onDeviceChange, 
  onVolumeChange 
}: {
  sound: SoundEntry;
  devices: AudioDevice[];
  isPlaying: boolean;
  onDeviceChange: (soundId: string, deviceName: string) => void;
  onVolumeChange: (soundId: string, volume: number) => void;
}) => {
  const activeDevice = sound.output_device || "default";
  
  // live availability
  const isAvailable = activeDevice === "default" 
    ? true 
    : devices.some(d => d.name === activeDevice);

  // Animate VU meter bars
  const [vuLevels, setVuLevels] = useState([10, 10, 10]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setVuLevels([
          Math.floor(Math.random() * 80) + 20,
          Math.floor(Math.random() * 80) + 20,
          Math.floor(Math.random() * 80) + 20,
        ]);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVuLevels([10, 10, 10]);
    }
  }, [isPlaying]);

  const getDeviceColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("sonar")) {
      if (lower.includes("gaming")) return "text-orange-400 border-orange-500/30";
      if (lower.includes("chat")) return "text-green-400 border-green-500/30";
      if (lower.includes("media")) return "text-blue-400 border-blue-500/30";
      if (lower.includes("aux")) return "text-purple-400 border-purple-500/30";
    }
    return "text-zinc-400 border-zinc-700/50";
  };

  return (
    <div 
      className="flex flex-col gap-2 bg-brand-500/10 p-3 rounded-lg border border-brand-500/20"
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-xs">
        {/* Device Status Indicator */}
        <div className="flex items-center gap-1.5 truncate">
          <span 
            className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
            title={isAvailable ? "Device Active" : "Device Offline - Fallback Active"}
          />
          <span className={`font-mono font-medium truncate max-w-[120px] ${getDeviceColor(activeDevice)}`}>
            {activeDevice}
          </span>
        </div>

        {/* Small VU Meter */}
        <div className="flex gap-0.5 h-4 items-end px-2">
          {vuLevels.map((lvl, idx) => (
            <div 
              key={idx}
              className={`w-1 rounded-t-sm transition-all duration-100 ${
                isPlaying ? "bg-[#6c8089]" : "bg-zinc-750"
              }`}
              style={{ height: `${lvl}%` }}
            />
          ))}
        </div>
      </div>

      {/* Custom Dropdown select box */}
      {SHOW_PLAYBACK_SELECTOR && (
        <div className="relative w-full">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between rounded bg-brand-500/10 border border-brand-500/30 px-2.5 py-1.5 text-xs text-brand-100 focus:outline-none cursor-pointer transition hover:border-[#6c8089]/40 active:scale-[0.985] text-right"
            dir="rtl"
          >
            <span className="truncate max-w-[120px] text-right">
              {activeDevice === "default" ? "Default Playback" : activeDevice}
            </span>
            <ChevronDown size={12} className="text-zinc-500 flex-shrink-0 mr-1" />
          </button>

          {isDropdownOpen && (
            <>
              {/* Transparent backdrop to click-away */}
              <div 
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setIsDropdownOpen(false)}
              />
              <div 
                className="absolute left-0 right-0 bottom-full mb-1.5 z-50 bg-brand-900 border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto custom-scrollbar flex flex-col p-1"
                dir="rtl"
              >
                <button
                  onClick={() => {
                    onDeviceChange(sound.id, "default");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-right px-2.5 py-1.5 text-[11px] rounded-lg transition-colors cursor-pointer ${
                    activeDevice === "default" 
                      ? "bg-brand-700/15 text-brand-100 font-bold" 
                      : "text-brand-300 hover:bg-white/5 hover:text-brand-100"
                  }`}
                >
                  Default Playback
                </button>
                {devices.map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      onDeviceChange(sound.id, d.name);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-right px-2.5 py-1.5 text-[11px] rounded-lg transition-colors truncate cursor-pointer ${
                      activeDevice === d.name 
                        ? "bg-brand-700/15 text-brand-100 font-bold" 
                        : "text-brand-300 hover:bg-white/5 hover:text-brand-100"
                    }`}
                    title={`${d.name} ${d.is_sonar ? "(Sonar)" : ""}`}
                  >
                    {d.name} {d.is_sonar ? "(Sonar)" : ""}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Volume slider */}
      {SHOW_VOLUME_SLIDER && (
        <div className="flex items-center gap-2 mt-1">
          <Volume2 className="h-3 w-3 text-zinc-500" />
          <input
            type="range"
            min="0"
            max="100"
            value={sound.volume}
            onChange={(e) => onVolumeChange(sound.id, parseInt(e.target.value))}
            className="volume-slider flex-1"
          />
          <span className="text-[9px] font-mono text-zinc-500 w-6 text-right">{sound.volume}%</span>
        </div>
      )}
    </div>
  );
};

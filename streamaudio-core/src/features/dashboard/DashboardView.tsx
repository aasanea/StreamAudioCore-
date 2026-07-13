import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Sliders, Mic, Volume2, 
  RefreshCw, Radio, ChevronDown 
} from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { AudioDevice } from "../../types";
import { useLanguage } from "../../i18n";

// Helper to clean device names containing markdown artifacts or broken unicode
const cleanDeviceName = (name: string): string => {
  if (!name) return "";
  return name
    .replace(/^\*\*v\*\*/gi, "") // Remove starting markdown artifacts
    .replace(/^.*?Series/g, "SteelSeries") // Clean SteelSeries naming
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Clean zero-width spaces
    .trim();
};

// Extremely performant VU Meter component using raw DOM manipulation to bypass React render cycle
const VUMeter: React.FC<{ isActive: boolean; gain: number }> = React.memo(({ isActive, gain }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) {
      // Clear level if inactive
      if (containerRef.current) {
        const bars = containerRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          (bars[i] as HTMLDivElement).style.transform = "scaleY(0.08)";
          (bars[i] as HTMLDivElement).style.backgroundColor = "rgba(128, 170, 160, 0.2)";
        }
      }
      return;
    }

    const bars = containerRef.current.children;
    const numBars = bars.length;
    let phase = 0;

    const updateMeter = () => {
      phase += 0.15;
      
      for (let i = 0; i < numBars; i++) {
        // Calculate simulated sound level using multiple sine waves and noise
        const baseOffset = (i / numBars) * Math.PI;
        const sineVal = Math.sin(phase + baseOffset) * 0.4 + 0.5;
        const noiseVal = Math.random() * 0.2;
        
        // Scale by gain (normalized from 0-100 to 0.2-2.0 multiplier)
        const gainMultiplier = 0.2 + (gain / 100) * 1.8;
        let level = (sineVal + noiseVal) * gainMultiplier * 0.85;
        
        // Clamp level
        level = Math.max(0.05, Math.min(1.0, level));

        const bar = bars[i] as HTMLDivElement;
        if (bar) {
          bar.style.transform = `scaleY(${level})`;
          
          // Color coding for visualizer (green -> yellow -> red)
          if (level > 0.85) {
            bar.style.backgroundColor = "#ef4444"; // Clip warning
          } else if (level > 0.65) {
            bar.style.backgroundColor = "#eab308"; // High level
          } else {
            bar.style.backgroundColor = "#80AAA0"; // Healthy level (primary accent)
          }
        }
      }

      animationRef.current = requestAnimationFrame(updateMeter);
    };

    animationRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, gain]);

  return (
    <div className="flex flex-col gap-2 bg-black/20 p-4 rounded-xl border border-brand-500/10">
      <div className="flex justify-between items-center text-[10px] text-brand-300 font-bold uppercase tracking-wider">
        <span>Level Monitor</span>
        <span className={isActive ? "text-[#80AAA0] animate-pulse" : "text-brand-300"}>
          {isActive ? "Live" : "Standby"}
        </span>
      </div>
      <div 
        ref={containerRef} 
        className="flex items-end gap-1 h-14 w-full bg-black/30 px-3 py-1.5 rounded-lg overflow-hidden border border-brand-500/5"
      >
        {Array.from({ length: 24 }).map((_, idx) => (
          <div 
            key={idx}
            className="flex-1 h-full rounded-t-sm origin-bottom transition-transform duration-75 scale-y-[0.08]"
            style={{ 
              backgroundColor: "rgba(128, 170, 160, 0.2)",
              willChange: "transform, background-color"
            }}
          />
        ))}
      </div>
    </div>
  );
});

VUMeter.displayName = "VUMeter";

// Highly polished custom Toggle Switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description: string;
}> = React.memo(({ checked, onChange, label, description }) => {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-500/5 border border-brand-500/10 hover:border-brand-500/20 transition-all duration-300">
      <div className="flex flex-col text-right pr-2">
        <span className="text-xs font-bold text-brand-100">{label}</span>
        <span className="text-[10px] text-brand-300 mt-0.5">{description}</span>
      </div>
      
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${
          checked ? "bg-[#80AAA0]" : "bg-black/40 border border-brand-500/20"
        }`}
      >
        <span 
          className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-brand-100 shadow-md transition-transform duration-300 ${
            checked ? "-translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";

interface DashboardViewProps {
  devices: AudioDevice[];
  globalOutputDevice: string;
  onDeviceChange: (deviceName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  globalOutputDevice,
  onDeviceChange
}) => {
  const { t } = useLanguage();
  const [gain, setGain] = useState(70);
  const [micActive, setMicActive] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(false);
  const [selectedInput, setSelectedInput] = useState("default");
  
  // Audio Input devices filter
  const inputDevices = useMemo(() => {
    // Return mock input devices for rich UI representation
    return [
      { id: "default", name: t('dash_mock_default'), is_sonar: false },
      { id: "mic-1", name: "SteelSeries Sonar - Microphone (Virtual)", is_sonar: true },
      { id: "mic-2", name: "Yeti Stereo Microphone", is_sonar: false },
      { id: "mic-3", name: "Virtual Audio Cable (Input)", is_sonar: false }
    ];
  }, []);

  const handleGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGain(Number(e.target.value));
  }, []);

  return (
    <div className="p-8 flex flex-col gap-6 max-w-5xl mx-auto" dir="rtl">
      
      {/* Header section */}
      <div className="flex justify-between items-center border-b border-brand-500/20 pb-5">
        <div className="text-right">
          <h1 className="text-2xl font-black text-brand-100 flex items-center gap-2.5">
            <Sliders className="text-[#80AAA0] h-6 w-6" />
            {t('dash_title')}
          </h1>
          <p className="text-xs text-brand-300 mt-1">{t('dash_subtitle')}</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200 hover:text-brand-100 hover:bg-brand-500/20 transition-all cursor-pointer"
            onClick={() => {
              // Refresh action
            }}
          >
            <RefreshCw size={12} className="animate-spin-slow" />
            {t('dash_refresh_devices')}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column (Mic and VU Settings) - 7 cols */}
        <div className="md:col-span-7 flex flex-col gap-6">
          <GlassPanel intensity="low" className="p-6 flex flex-col gap-5 bg-brand-500/5 border-brand-500/10 relative overflow-hidden">
            <div className="flex justify-between items-start z-10">
              <div className="text-right">
                <span className="text-[10px] font-bold text-[#80AAA0] uppercase tracking-widest">{t('dash_input_settings')}</span>
                <h3 className="text-lg font-black text-brand-100 mt-1 flex items-center gap-2">
                  <Mic size={18} className="text-[#80AAA0]" />
                  {t('dash_mic_radar')}
                </h3>
              </div>
              <button 
                onClick={() => setMicActive(!micActive)}
                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                  micActive 
                    ? "bg-[#80AAA0]/20 text-[#80AAA0] border border-[#80AAA0]/40" 
                    : "bg-red-500/20 text-red-400 border border-red-500/40"
                }`}
              >
                {micActive ? t('dash_active') : t('dash_inactive')}
              </button>
            </div>

            {/* Input Selection Dropdown */}
            <div className="flex flex-col gap-1.5 text-right z-10">
              <label className="text-[10px] text-brand-300 font-bold tracking-wide">{t('dash_mic_device')}</label>
              <div className="relative group">
                <select 
                  value={selectedInput}
                  onChange={(e) => setSelectedInput(e.target.value)}
                  className="w-full appearance-none bg-black/30 border border-brand-500/20 rounded-xl py-2.5 pl-3 pr-10 text-xs text-brand-100 outline-none cursor-pointer transition-all duration-300 focus:border-[#80AAA0]/50"
                >
                  {inputDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {cleanDeviceName(d.name)}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-300 group-hover:text-brand-100 transition-colors">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Gain Slider */}
            <div className="flex flex-col gap-2 text-right z-10">
              <div className="flex justify-between items-center text-[10px] text-brand-300 font-bold uppercase tracking-wider">
                <span>Gain: {gain}%</span>
                <span>{t('dash_pickup_level')}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={gain} 
                onChange={handleGainChange}
                className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#80AAA0] outline-none transition-all duration-300 focus:ring-1 focus:ring-[#80AAA0]/20"
              />
            </div>

            {/* Realtime VU Meter (Memoized and Dom-manipulated) */}
            <VUMeter isActive={micActive} gain={gain} />

            {/* Hardware Filters */}
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-[10px] text-brand-300 font-bold uppercase tracking-wider text-right">{t('dash_dsp_filters')}</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ToggleSwitch 
                  checked={noiseSuppression} 
                  onChange={setNoiseSuppression} 
                  label={t('dash_noise_sup')}
                  description={t('dash_noise_sup_desc')}
                />
                <ToggleSwitch 
                  checked={echoCancellation} 
                  onChange={setEchoCancellation} 
                  label={t('dash_echo_cancel')}
                  description={t('dash_echo_cancel_desc')}
                />
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Right Column (Routing & Quick widget) - 5 cols */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <GlassPanel intensity="low" className="p-6 flex flex-col gap-5 bg-brand-500/5 border-brand-500/10">
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#80AAA0] uppercase tracking-widest">{t('dash_output_management')}</span>
              <h3 className="text-lg font-black text-brand-100 mt-1 flex items-center gap-2">
                <Volume2 size={18} className="text-[#80AAA0]" />
                {t('dash_system_output')}
              </h3>
            </div>

            {/* System Audio Dropdown (Synced with top bar dropdown) */}
            <div className="flex flex-col gap-1.5 text-right">
              <label className="text-[10px] text-brand-300 font-bold tracking-wide">{t('dash_main_output')}</label>
              <div className="relative group">
                <select 
                  value={globalOutputDevice}
                  onChange={(e) => onDeviceChange(e.target.value)}
                  className="w-full appearance-none bg-black/30 border border-brand-500/20 rounded-xl py-2.5 pl-3 pr-10 text-xs text-brand-100 outline-none cursor-pointer transition-all duration-300 focus:border-[#80AAA0]/50"
                >
                  <option value="default">Default System Device</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.name}>
                      {cleanDeviceName(d.name)}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-300 group-hover:text-brand-100 transition-colors">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Routing Cards mock */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] text-brand-300 font-bold uppercase tracking-wider text-right">{t('dash_virtual_cables')}</span>
              
              <div className="p-3 bg-black/25 border border-brand-500/10 rounded-xl flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-200 border border-brand-500/20">{t('dash_active_port')}</span>
                <div className="text-right">
                  <h4 className="text-xs font-bold text-brand-100">{t('dash_gaming_channel')}</h4>
                  <p className="text-[9px] text-brand-300 mt-0.5">{t('dash_gaming_desc')}</p>
                </div>
              </div>

              <div className="p-3 bg-black/25 border border-brand-500/10 rounded-xl flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#80AAA0]/10 text-[#80AAA0] border border-[#80AAA0]/20">{t('dash_current_listener')}</span>
                <div className="text-right">
                  <h4 className="text-xs font-bold text-brand-100">{t('dash_chat_channel')}</h4>
                  <p className="text-[9px] text-brand-300 mt-0.5">{t('dash_chat_desc')}</p>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* Quick-Launch / SAMPLER Status widget */}
          <GlassPanel intensity="low" className="p-5 flex flex-col gap-3 bg-brand-500/5 border-brand-500/10 hover:border-brand-500/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <Radio className="text-[#80AAA0] animate-pulse h-4 w-4" />
              <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">{t('dash_perf_summary')}</span>
            </div>
            <div className="text-right">
              <h4 className="text-xs font-black text-brand-100">{t('dash_sampler_ready')}</h4>
              <p className="text-[10px] text-brand-300 mt-0.5">{t('dash_routing_info')}</p>
            </div>
          </GlassPanel>
        </div>

      </div>
    </div>
  );
};

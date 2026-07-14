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

// Professional Studio Stereo VU Meter component using raw DOM manipulation to bypass React render cycle
const VUMeter: React.FC<{ isActive: boolean; gain: number }> = React.memo(({ isActive, gain }) => {
  const leftBarRef = useRef<HTMLDivElement>(null);
  const rightBarRef = useRef<HTMLDivElement>(null);
  const leftPeakRef = useRef<HTMLDivElement>(null);
  const rightPeakRef = useRef<HTMLDivElement>(null);
  const leftValRef = useRef<HTMLSpanElement>(null);
  const rightValRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);

  // Peak hold references (fraction 0-1)
  const peaks = useRef({ left: 0.0, right: 0.0 });
  const holdFrames = useRef({ left: 0, right: 0 });
  
  useEffect(() => {
    if (!isActive) {
      // Clear levels on standby
      if (leftBarRef.current) leftBarRef.current.style.transform = "scaleX(0)";
      if (rightBarRef.current) rightBarRef.current.style.transform = "scaleX(0)";
      if (leftPeakRef.current) leftPeakRef.current.style.left = "0%";
      if (rightPeakRef.current) rightPeakRef.current.style.left = "0%";
      if (leftValRef.current) {
        leftValRef.current.textContent = "-∞ dB";
        leftValRef.current.className = "text-brand-300 text-[10px] font-mono w-16 text-right";
      }
      if (rightValRef.current) {
        rightValRef.current.textContent = "-∞ dB";
        rightValRef.current.className = "text-brand-300 text-[10px] font-mono w-16 text-right";
      }
      return;
    }

    let phase = 0;
    const HOLD_DURATION = 75; // ~1.25 seconds at 60fps
    const DECAY_RATE = 0.012; // decay per frame
    
    // Track values for smoothed random walks
    let lTarget = 0.5;
    let rTarget = 0.5;
    let lCurrent = 0.02;
    let rCurrent = 0.02;

    const getFraction = (val: number) => {
      if (val <= 0.001) return 0;
      const db = 20 * Math.log10(val);
      const fraction = (db - (-60)) / 60;
      return Math.max(0, Math.min(1, fraction));
    };

    const updateMeter = () => {
      phase += 0.06;

      // Base input volume from gain setting
      const maxLvl = Math.max(0.05, gain / 100);

      // Correlation random walks to simulate realistic stereo music/voice bounce
      const baseChange = (Math.random() - 0.5) * 0.18;
      const lChange = baseChange + (Math.random() - 0.5) * 0.08;
      const rChange = baseChange + (Math.random() - 0.5) * 0.08;

      lTarget = Math.max(0.01, Math.min(maxLvl, lTarget + lChange));
      rTarget = Math.max(0.01, Math.min(maxLvl, rTarget + rChange));

      // Lerp for butter-smooth visual translation
      lCurrent = lCurrent + (lTarget - lCurrent) * 0.25;
      rCurrent = rCurrent + (rTarget - rCurrent) * 0.25;

      const lFraction = getFraction(lCurrent);
      const rFraction = getFraction(rCurrent);

      // Update linear-in-dB bars
      if (leftBarRef.current) leftBarRef.current.style.transform = `scaleX(${lFraction})`;
      if (rightBarRef.current) rightBarRef.current.style.transform = `scaleX(${rFraction})`;

      // Left peak hold calculation
      if (lFraction >= peaks.current.left) {
        peaks.current.left = lFraction;
        holdFrames.current.left = HOLD_DURATION;
      } else {
        if (holdFrames.current.left > 0) {
          holdFrames.current.left--;
        } else {
          peaks.current.left = Math.max(0, peaks.current.left - DECAY_RATE);
        }
      }

      // Right peak hold calculation
      if (rFraction >= peaks.current.right) {
        peaks.current.right = rFraction;
        holdFrames.current.right = HOLD_DURATION;
      } else {
        if (holdFrames.current.right > 0) {
          holdFrames.current.right--;
        } else {
          peaks.current.right = Math.max(0, peaks.current.right - DECAY_RATE);
        }
      }

      // Update Peak indicator positions
      if (leftPeakRef.current) {
        leftPeakRef.current.style.left = `${peaks.current.left * 99}%`;
      }
      if (rightPeakRef.current) {
        rightPeakRef.current.style.left = `${peaks.current.right * 99}%`;
      }

      // Numerical dB calculation
      const lDb = -60 + lFraction * 60;
      const rDb = -60 + rFraction * 60;

      // Update left text styles
      if (leftValRef.current) {
        leftValRef.current.textContent = lFraction <= 0.01 ? "-∞ dB" : `${lDb.toFixed(1)} dB`;
        if (lDb > -0.5) {
          leftValRef.current.className = "text-red-500 font-extrabold scale-110 transition-transform duration-100 animate-pulse text-[10px] font-mono w-16 text-right";
        } else if (lDb > -6) {
          leftValRef.current.className = "text-yellow-400 font-bold text-[10px] font-mono w-16 text-right";
        } else {
          leftValRef.current.className = "text-brand-300 text-[10px] font-mono w-16 text-right";
        }
      }

      // Update right text styles
      if (rightValRef.current) {
        rightValRef.current.textContent = rFraction <= 0.01 ? "-∞ dB" : `${rDb.toFixed(1)} dB`;
        if (rDb > -0.5) {
          rightValRef.current.className = "text-red-500 font-extrabold scale-110 transition-transform duration-100 animate-pulse text-[10px] font-mono w-16 text-right";
        } else if (rDb > -6) {
          rightValRef.current.className = "text-yellow-400 font-bold text-[10px] font-mono w-16 text-right";
        } else {
          rightValRef.current.className = "text-brand-300 text-[10px] font-mono w-16 text-right";
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
    <div className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-brand-500/10 backdrop-blur-md shadow-lg">
      {/* Header Info */}
      <div className="flex justify-between items-center text-[10px] text-brand-300 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Sliders size={12} className="text-[#80AAA0]" />
          Level Monitor (Stereo)
        </span>
        <span className={isActive ? "text-[#80AAA0] animate-pulse font-extrabold" : "text-brand-300"}>
          {isActive ? "LIVE" : "STANDBY"}
        </span>
      </div>
      
      {/* Stereo channels VU */}
      <div className="flex flex-col gap-3.5 my-1" dir="ltr">
        {/* Left Channel */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-brand-300 w-3">L</span>
          <div className="flex-1 h-3.5 bg-black/40 rounded relative overflow-hidden border border-brand-500/10 shadow-inner">
            <div 
              ref={leftBarRef}
              className="absolute inset-y-0 left-0 w-full origin-left scale-x-[0.02] rounded-r-sm"
              style={{
                background: "linear-gradient(to right, #80AAA0 0%, #80AAA0 70%, #eab308 70%, #eab308 90%, #ef4444 90%, #ef4444 100%)",
                willChange: "transform"
              }}
            />
            <div 
              ref={leftPeakRef}
              className="absolute inset-y-0 left-0 w-0.5 bg-white origin-left shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ willChange: "transform" }}
            />
          </div>
          <span ref={leftValRef} className="text-[10px] font-mono text-brand-300 w-16 text-right transition-transform duration-100">
            -60.0 dB
          </span>
        </div>

        {/* Right Channel */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-brand-300 w-3">R</span>
          <div className="flex-1 h-3.5 bg-black/40 rounded relative overflow-hidden border border-brand-500/10 shadow-inner">
            <div 
              ref={rightBarRef}
              className="absolute inset-y-0 left-0 w-full origin-left scale-x-[0.02] rounded-r-sm"
              style={{
                background: "linear-gradient(to right, #80AAA0 0%, #80AAA0 70%, #eab308 70%, #eab308 90%, #ef4444 90%, #ef4444 100%)",
                willChange: "transform"
              }}
            />
            <div 
              ref={rightPeakRef}
              className="absolute inset-y-0 left-0 w-0.5 bg-white origin-left shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ willChange: "transform" }}
            />
          </div>
          <span ref={rightValRef} className="text-[10px] font-mono text-brand-300 w-16 text-right transition-transform duration-100">
            -60.0 dB
          </span>
        </div>
      </div>

      {/* Scale ticks */}
      <div className="flex justify-between px-6 text-[8px] font-mono font-black text-brand-300/50 border-t border-brand-500/5 pt-1.5" dir="ltr">
        <span style={{ transform: "translateX(-2px)" }}>-60</span>
        <span style={{ transform: "translateX(-50%)" }}>-45</span>
        <span style={{ transform: "translateX(-50%)" }}>-30</span>
        <span style={{ transform: "translateX(-50%)" }}>-18</span>
        <span style={{ transform: "translateX(-50%)" }}>-12</span>
        <span style={{ transform: "translateX(-50%)" }}>-6</span>
        <span style={{ transform: "translateX(2px)" }} className="text-red-400/80">0 dB</span>
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
  onRefreshDevices?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  globalOutputDevice,
  onDeviceChange,
  onRefreshDevices
}) => {
  const { t } = useLanguage();
  const [gain, setGain] = useState(70);
  const [micActive, setMicActive] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(false);
  const [selectedInput, setSelectedInput] = useState("default");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefreshDevices && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefreshDevices();
      } catch (err) {
        console.error("Failed to refresh devices:", err);
      } finally {
        setTimeout(() => setIsRefreshing(false), 800);
      }
    }
  };
  
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200 hover:text-brand-100 hover:bg-brand-500/20 transition-all cursor-pointer ${
              isRefreshing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : "animate-spin-slow"} />
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
                  className="w-full appearance-none bg-black/30 border border-brand-500/20 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-100 outline-none cursor-pointer transition-all duration-300 focus:border-[#80AAA0]/50"
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
                  className="w-full appearance-none bg-black/30 border border-brand-500/20 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-100 outline-none cursor-pointer transition-all duration-300 focus:border-[#80AAA0]/50"
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

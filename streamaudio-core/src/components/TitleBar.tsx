import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AudioLines } from "lucide-react";
import { useAppVersion } from "../hooks/useAppVersion";
import { useLanguage } from "../i18n";

interface TitleBarProps {
  activeTab: string;
}

export const TitleBar = ({ activeTab }: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWindow();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const appVersion = useAppVersion();
  const { t } = useLanguage();

  useEffect(() => {
    win.isMaximized().then(setIsMaximized);
    const unlisten = win.onResized(() => {
      win.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const handleMinimize = () => win.minimize();
  const handleMaximize = () => win.toggleMaximize();
  const handleClose = () => win.close();

  const tabLabel: Record<string, string> = {
    sampler: "SAMPLER",
    library: "LIBRARY",
    cloud: "CLOUD SYNC",
    downloader: "DOWNLOADER",
    dashboard: "DASHBOARD",
  };

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between select-none px-4"
      style={{
        height: "38px",
        background: "#090916",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
      }}
      // Allow dragging the entire bar (Tauri drag region)
      data-tauri-drag-region
    >
      {/* Left: Premium Monochromatic Control Capsule */}
      <div className="flex items-center" style={{ minWidth: "90px" }}>
        <div className="flex items-center gap-4 bg-white/[0.02] border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md shadow-inner">
          {/* Close */}
          <button
            onClick={handleClose}
            className="text-brand-300 hover:text-red-400 hover:scale-115 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center"
            title={t('tb_close')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="text-brand-300 hover:text-green-400 hover:scale-115 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center"
            title={t('tb_minimize')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Maximize/Restore */}
          <button
            onClick={handleMaximize}
            className="text-brand-300 hover:text-indigo-400 hover:scale-115 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center"
            title={isMaximized ? t('tb_restore') : t('tb_maximize')}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M3 1H8C8.55228 1 9 1.44772 9 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Center: App identity + active tab */}
      <div
        className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2"
        data-tauri-drag-region
      >
        <AudioLines className="h-3.5 w-3.5 text-brand-700 animate-pulse" />
        <span
          className="text-[11px] font-bold tracking-[0.22em] uppercase text-brand-100 font-sans"
        >
          StreamAudio Core
        </span>
        {tabLabel[activeTab] && (
          <>
            <span
              className="text-[10px] font-sans mx-0.5 text-brand-300/30"
            >
              /
            </span>
            <span
              className="text-[10px] font-sans font-black tracking-[0.18em] text-brand-700"
            >
              {tabLabel[activeTab]}
            </span>
          </>
        )}
      </div>

      {/* Right: Version badge & connection status */}
      <div className="flex items-center gap-3.5" style={{ minWidth: "110px", justifySelf: "flex-end", justifyContent: "flex-end" }}>
        <div 
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isOnline ? "bg-[#22C55E] shadow-[0_0_8px_#22C55E]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
          }`}
          title={isOnline ? t('tb_online') : t('tb_offline')}
        />
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-md font-bold"
          style={{
            background: "rgba(34, 197, 94, 0.06)",
            border: "1px solid rgba(34, 197, 94, 0.15)",
            color: "#22C55E",
            letterSpacing: "0.08em",
          }}
        >
          {appVersion}
        </span>
      </div>
    </div>
  );
};

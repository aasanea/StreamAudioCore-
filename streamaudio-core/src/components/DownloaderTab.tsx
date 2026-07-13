import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Download, X, Scissors, Folder, Square,
  List, History, AlertCircle, CheckCircle,
  Loader2, ChevronDown, Globe, FileVideo,
  Music, GripVertical
} from "lucide-react";
import { useLanguage } from "../i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoQuality { id: string; label: string; }
interface VideoMetadata {
  is_playlist: boolean;
  title: string;
  duration?: number;
  thumbnail?: string;
  video_qualities: VideoQuality[];
  audio_qualities: VideoQuality[];
  entries?: { title: string; url: string }[];
}

interface QueueItem {
  id: string;
  title: string;
  url: string;
  format: string;
  quality: string;
  outputPath: string | null;
  startTime: string | null;
  endTime: string | null;
  cookiesFrom: string;
  status: "pending" | "downloading" | "done" | "failed";
  progress: number;
  speed: string;
  eta: string;
}

interface HistoryItem {
  title: string;
  format: string;
  quality: string;
  filePath: string;
  timestamp: string;
}

// ─── Top 20 Site Icons ────────────────────────────────────────────────────────
const TOP_SITES = [
  { name: "YouTube", svg: '<svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.516 3.514 12 3.514 12 3.514s-7.516 0-9.388.541a3.003 3.003 0 0 0-2.11 2.108C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.872.541 9.388.541 9.388.541s7.516 0 9.388-.541a3.003 3.003 0 0 0 2.11-2.108C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' },
  { name: "TikTok", svg: '<svg class="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.01 1.62 4.19.92.99 2.18 1.65 3.5 1.93v3.83c-1.63-.04-3.2-.55-4.51-1.56-.09.08-.18.17-.27.26-.06 5.5-.1 11-.12 16.5-.12 3.25-2.22 6.27-5.38 7.02-3.32.96-7.07-.64-8.48-3.75-1.57-3.21-.49-7.52 2.58-9.45 1.49-.97 3.32-1.35 5.08-1.07v3.9c-1.13-.33-2.39-.12-3.33.55-1.18.82-1.72 2.37-1.33 3.76.36 1.4 1.7 2.4 3.15 2.27 1.68-.04 2.94-1.51 2.91-3.2.02-4.75.01-9.51.01-14.26V.02z"/></svg>' },
  { name: "Instagram", svg: '<svg class="w-4 h-4 text-pink-500 stroke-current fill-none" stroke-width="2.2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' },
  { name: "Facebook", svg: '<svg class="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
  { name: "Twitter / X", svg: '<svg class="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
  { name: "SoundCloud", svg: '<svg class="w-4 h-4 text-orange-500 fill-current" viewBox="0 0 24 24"><path d="M8.22 17.27a.5.5 0 0 1-.5-.5V8.87a.5.5 0 0 1 1 0v7.9a.5.5 0 0 1-.5.5zm-2-.5a.5.5 0 0 1-1 0v-6.9a.5.5 0 0 1 1 0v6.9zm-2-1a.5.5 0 0 1-1 0v-4.9a.5.5 0 0 1 1 0v4.9zm-2-1.5a.5.5 0 0 1-1 0v-1.9a.5.5 0 0 1 1 0v1.9zm8.5 3a.5.5 0 0 1-.5-.5V7.87a.5.5 0 0 1 1 0v8.9a.5.5 0 0 1-.5.5zm11.5-1.5c0-2.48-1.52-4.5-3.4-4.5-.42 0-.81.1-1.18.28A5.14 5.14 0 0 0 14.5 9c-2.48 0-4.5 2.02-4.5 4.5 0 .2.02.4.05.6a1 1 0 0 1-.05.4v2.5c0 .28.22.5.5.5h11c.28 0 .5-.22.5-.5v-3.5z"/></svg>' },
  { name: "Twitch", svg: '<svg class="w-4 h-4 text-purple-500 fill-current" viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>' },
  { name: "Vimeo", svg: '<svg class="w-4 h-4 text-blue-400 fill-current" viewBox="0 0 24 24"><path d="M22.396 7.2c-.09 1.89-1.418 4.478-3.987 7.764-2.637 3.402-4.87 5.101-6.697 5.101-1.127 0-2.079-1.037-2.856-3.109-.526-1.936-1.053-3.87-1.58-5.807-.577-2.115-1.199-3.173-1.867-3.173-.146 0-.663.303-1.551.91l-.927-1.192c1.002-.88 1.99-1.761 2.964-2.64 1.332-1.145 2.333-1.75 3.003-1.815 1.573-.15 2.544.928 2.915 3.238.406 2.507.691 4.053.856 4.639.467 1.872.962 2.809 1.488 2.809.406 0 1.052-.638 1.94-1.913.887-1.275 1.353-2.228 1.401-2.859.09-.99-.255-1.486-1.037-1.486-.361 0-.742.083-1.145.247a3.842 3.842 0 0 0 2.569-3.593c0-1.777-1.293-2.62-3.879-2.527C17.151.341 22.57 2.1 22.396 7.2z"/></svg>' },
  { name: "Reddit", svg: '<svg class="w-4 h-4 text-orange-600 fill-current" viewBox="0 0 24 24"><path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.75-1.64-5.99-1.72l1.23-3.86 3.39.77c.08 1.15 1.05 2.07 2.21 2.07 1.21 0 2.2-1 2.2-2.2s-1-2.2-2.2-2.2c-1.02 0-1.88.7-2.12 1.65l-3.69-.84a.48.48 0 0 0-.55.32l-1.37 4.31c-2.31.06-4.48.7-6.17 1.73-.55-.74-1.43-1.21-2.41-1.21-1.65 0-3 1.35-3 3 0 1.09.59 2.04 1.47 2.56-.05.3-.08.6-.08.94 0 3.75 4.81 6.8 10.75 6.8s10.75-3.05 10.75-6.8c0-.34-.03-.64-.08-.94.88-.52 1.47-1.47 1.47-2.56zm-17.5 1c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9.63 4.56c-.66.66-1.81.94-3.13.94s-2.47-.28-3.13-.94a.5.5 0 1 1 .7-.7c.48.48 1.38.69 2.43.69s1.95-.21 2.43-.69a.5.5 0 1 1 .7.7zm-.63-2.56c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>' },
  { name: "Pinterest", svg: '<svg class="w-4 h-4 text-red-600 fill-current" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.906 2.17-2.906 1.024 0 1.517.769 1.517 1.688 0 1.029-.656 2.568-.992 3.993-.285 1.193.6 2.169 1.775 2.169 2.128 0 3.768-2.245 3.768-5.487 0-2.868-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.21-.174.254-.402.149-1.498-.696-2.439-2.885-2.439-4.639 0-3.774 2.748-7.239 7.906-7.239 4.161 0 7.385 2.966 7.385 6.91 0 4.13-2.6 7.457-6.21 7.457-1.212 0-2.348-.63-2.738-1.373 0 0-.599 2.278-.744 2.835-.27.103-.999.624-1.407.973-.41.349-.82.697-.82.697 1.362.41 2.805.624 4.305.624 6.621 0 11.988-5.367 11.988-11.988C24.017 5.367 18.64 0 12.017 0z"/></svg>' },
  { name: "Spotify", svg: '<svg class="w-4 h-4 text-green-500 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.06-.84-.18-.9-.6-.06-.42.18-.84.6-.9 4.56-1.08 8.52-.66 11.64 1.26.3.24.42.66.24 1.14zm1.44-3.24c-.3.42-.9.54-1.32.24-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.56 1.68.36.18.48.78.24 1.2zm.12-3.36C15.24 8.4 9.6 8.16 6.18 9.18c-.54.18-1.14-.12-1.32-.66-.18-.54.12-1.14.66-1.32 3.9-1.2 10.14-.9 14.88 1.92.48.3.66.9.36 1.38-.24.48-.9.66-1.38.42z"/></svg>' },
  { name: "Telegram", svg: '<svg class="w-4 h-4 text-blue-400 fill-current" viewBox="0 0 24 24"><path d="M11.944 0C5.337 0 0 5.337 0 11.944c0 6.608 5.337 11.944 11.944 11.944 6.608 0 11.944-5.336 11.944-11.944C23.888 5.337 18.552 0 11.944 0zm5.836 8.3c-.15 1.57-1.14 7.42-1.65 10.15-.22 1.16-.65 1.55-1.06 1.59-.9.08-1.58-.6-2.45-1.17-1.37-.9-2.14-1.46-3.47-2.33-1.53-1-1.08-1.55.33-3.02 1.11-1.15 6.78-6.22 6.89-6.68.01-.06.02-.27-.11-.38-.13-.11-.32-.07-.46-.04-.2 0-3.33 2.1-9.4 6.17-.89.61-1.69.91-2.41.9-.79-.02-2.32-.45-3.46-.82-1.4-.45-2.52-.69-2.42-1.46.05-.4.6-.82 1.66-1.25 6.49-2.83 10.82-4.7 12.98-5.6 6.17-2.58 7.46-3.03 8.29-3.04.18 0 .59.04.86.26.23.18.29.43.32.61.03.18.04.54.02.73z"/></svg>' },
  { name: "Snapchat", svg: '<svg class="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24"><path d="M12 1.93c-.93 0-3.3.49-4.8 1.48-1.67 1.1-2 2.39-2 4.4 0 1.25.32 2 1 2.92.17.22.18.33-.02.48A4.18 4.18 0 0 1 4.5 12c-1-.02-1.55-.38-2.02-.92-.22-.26-.35-.29-.53-.13-.3.26-.53.53-.4.92.21.65 1.05.99 2 1.08.35.03.48.16.48.48 0 .3-.15 1-.22 1.48a1.5 1.5 0 0 0 1.35 1.76c1.3.11 2.35-.16 2.87-.65a.5.5 0 0 1 .53-.13c.27.1.53.33.53.6v.92c0 2.21 2.5 4.3 6 4.3s6-2.09 6-4.3v-.92c0-.27.26-.5.53-.6a.5.5 0 0 1 .53.13c.52.49 1.57.76 2.87.65a1.5 1.5 0 0 0 1.35-1.76c-.07-.48-.22-1.18-.22-1.48 0-.32.13-.45.48-.48.95-.09 1.79-.43 2-1.08.13-.39-.1-.66-.4-.92-.18-.16-.31-.13-.53.13-.47.54-1.02.9-2.02.92a4.18 4.18 0 0 1-1.68-.81c-.2-.15-.19-.26-.02-.48.68-.92 1-1.67 1-2.92 0-2.01-.33-3.3-2-4.4-1.5-.99-3.87-1.48-4.8-1.48z"/></svg>' },
  { name: "Threads", svg: '<svg class="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.72 16.035c-.464.444-1.055.772-1.745.968-.7.2-1.47.302-2.278.302-1.467 0-2.695-.417-3.626-1.229C8.14 15.26 7.674 14.15 7.674 12.8c0-1.4.457-2.52 1.348-3.31.892-.8 2.062-1.205 3.475-1.205 1.332 0 2.428.375 3.238 1.107.81.733 1.227 1.738 1.227 2.96 0 1.154-.366 2.054-1.083 2.66-.718.608-1.614.912-2.645.912-.662 0-1.218-.172-1.644-.509-.426-.337-.645-.797-.645-1.358 0-.46.126-.874.372-1.226.246-.353.606-.653 1.063-.888.456-.235 1.01-.352 1.64-.352h1.492c.075-.41.114-.805.114-1.168 0-.74-.216-1.306-.638-1.67-.42-.363-.984-.546-1.666-.546-.86 0-1.57.243-2.094.717-.525.474-.8 1.144-.8 1.975v.232c0 .878.267 1.558.788 2.008.522.45 1.258.675 2.176.675.467 0 .897-.058 1.267-.17.37-.113.682-.266.924-.45l.397.747z"/></svg>' },
  { name: "LinkedIn", svg: '<svg class="w-4 h-4 text-blue-600 fill-current" viewBox="0 0 24 24"><path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9h3.56v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7H9.33V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z"/></svg>' },
];

interface ProgressPayload { pct: number; speed: string; eta: string; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
};

const sanitize = (name: string) =>
  name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim().substring(0, 180);

const isValidUrl = (v: string) =>
  v.startsWith("http://") || v.startsWith("https://");

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// ─── Fake Waveform ────────────────────────────────────────────────────────────

const FakeWaveform = memo(() => {
  const bars = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => {
      const v = Math.sin(i * 0.31) * 0.4 + Math.sin(i * 0.73) * 0.3
        + Math.cos(i * 0.17) * 0.2 + Math.sin(i * 1.1) * 0.1;
      return 15 + Math.abs(v) * 85;
    }), []);

  return (
    <div className="absolute inset-0 flex items-center gap-px px-1 opacity-50 pointer-events-none">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-full bg-ocean-500"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
});

// ─── Toast ────────────────────────────────────────────────────────────────────

const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-sm pointer-events-auto max-w-sm animate-in slide-in-from-right-4 duration-200
          ${t.type === "success" ? "bg-green-950/90 border-green-700/50 text-green-300" :
            t.type === "error" ? "bg-red-950/90 border-red-700/50 text-red-300" :
            "bg-zinc-900/90 border-zinc-700/50 text-zinc-200"}`}
      >
        {t.type === "success" ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> :
          t.type === "error" ? <AlertCircle className="h-4 w-4 flex-shrink-0" /> :
          <Globe className="h-4 w-4 flex-shrink-0" />}
        <span className="flex-1 text-xs">{t.message}</span>
        <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100 cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
);

// ─── Professional Cut Modal ───────────────────────────────────────────────────

interface CutModalProps {
  item: HistoryItem;
  onClose: () => void;
  onToast: (msg: string, type: Toast["type"]) => void;
}

const CutModal = ({ item, onClose, onToast }: CutModalProps) => {
  const { t } = useLanguage();
  const [duration, setDuration] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [cutting, setCutting] = useState(false);

  // Refs for RAF + drag (avoid stale closures)
  const durationRef = useRef(0);
  const startRef = useRef(0);
  const endRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isVideo = ["mp4", "webm", "mkv", "mov", "avi"].includes(item.format.toLowerCase());
  const srcUrl = convertFileSrc(item.filePath);
  const getPlayer = () => (isVideo ? videoRef.current : audioRef.current) as HTMLMediaElement | null;

  // Update refs when state changes
  useEffect(() => { startRef.current = startSec; }, [startSec]);
  useEffect(() => { endRef.current = endSec; }, [endSec]);

  // RAF playhead updater
  const tick = useCallback(() => {
    const p = getPlayer();
    if (p) setCurrentSec(p.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const handleLoaded = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const d = e.currentTarget.duration || 0;
    durationRef.current = d;
    setDuration(d);
    setEndSec(d);
    endRef.current = d;
  };

  // Drag logic — returns mousedown handler for a given handle
  const startDrag = useCallback((handle: "start" | "end") =>
    (e: React.MouseEvent) => {
      e.preventDefault();

      const onMove = (ev: MouseEvent) => {
        const track = trackRef.current;
        const dur = durationRef.current;
        if (!track || !dur) return;
        const rect = track.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
        const time = pct * dur;
        const p = getPlayer();

        if (handle === "start") {
          const clamped = Math.min(time, endRef.current - 0.5);
          startRef.current = clamped;
          setStartSec(clamped);
          if (p) p.currentTime = clamped;
        } else {
          const clamped = Math.max(time, startRef.current + 0.5);
          endRef.current = clamped;
          setEndSec(clamped);
          if (p) p.currentTime = clamped;
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click on timeline to seek
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const dur = durationRef.current;
    if (!track || !dur) return;
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = Math.min(dur, Math.max(0, pct * dur));
    const p = getPlayer();
    if (p) p.currentTime = time;
  };

  const handleCut = async () => {
    setCutting(true);
    try {
      const result = await invoke<string>("cut_local_video", {
        inputPath: item.filePath,
        startTime: fmt(startSec),
        endTime: fmt(endSec),
      });
      onToast(`${t('dl_cut_success')} ${result.split(/[\\/]/).pop()}`, "success");
      onClose();
    } catch (err: any) {
      onToast(`${t('dl_cut_fail')} ${err}`, "error");
    } finally {
      setCutting(false);
    }
  };

  // Derived percentages
  const leftPct = duration ? (startSec / duration) * 100 : 0;
  const endPct = duration ? (endSec / duration) * 100 : 100;
  const headPct = duration ? (currentSec / duration) * 100 : 0;
  const trimDuration = Math.max(0, endSec - startSec);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(108,128,137,0.15)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition cursor-pointer">
            <X className="h-5 w-5" />
          </button>
          <div className="text-right">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 justify-end">
              <Scissors className="h-4 w-4 text-ocean-400" />
              {t('dl_cut_title')}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[340px]">{item.title}</p>
          </div>
        </div>

        {/* Player */}
        <div className="bg-black/80 flex items-center justify-center min-h-[100px]">
          {isVideo ? (
            <video
              ref={videoRef}
              src={srcUrl}
              controls
              onLoadedMetadata={handleLoaded}
              className="w-full max-h-52 object-contain"
            />
          ) : (
            <div className="w-full px-8 py-8">
              <audio
                ref={audioRef}
                src={srcUrl}
                controls
                onLoadedMetadata={handleLoaded}
                className="w-full"
                style={{ filter: "invert(1) hue-rotate(180deg)" }}
              />
            </div>
          )}
        </div>

        {/* ─── Professional Timeline ─── */}
        <div className="px-5 pt-5 pb-2 bg-[#0c0c0c] select-none">

          {/* Time ruler labels */}
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-mono text-zinc-600">0:00</span>
            {duration > 0 && (
              <span className="text-[10px] font-mono text-zinc-600">{fmt(duration / 2)}</span>
            )}
            <span className="text-[10px] font-mono text-zinc-600">{fmt(duration)}</span>
          </div>

          {/* Main timeline track */}
          <div
            ref={trackRef}
            onMouseDown={handleTrackClick as any}
            className="relative rounded-lg overflow-hidden cursor-crosshair"
            style={{ height: "64px" }}
          >
            {/* Track background */}
            <div className="absolute inset-0 bg-zinc-900/80 rounded-lg" />

            {/* Fake waveform */}
            <FakeWaveform />

            {/* Dimmed left region (before start) */}
            <div
              className="absolute inset-y-0 left-0 bg-black/70 pointer-events-none z-10"
              style={{ width: `${leftPct}%` }}
            />

            {/* Dimmed right region (after end) */}
            <div
              className="absolute inset-y-0 right-0 bg-black/70 pointer-events-none z-10"
              style={{ width: `${100 - endPct}%` }}
            />

            {/* Selected region */}
            <div
              className="absolute inset-y-0 pointer-events-none z-20"
              style={{
                left: `${leftPct}%`,
                width: `${endPct - leftPct}%`,
                background: "rgba(108,128,137,0.12)",
                borderTop: "1.5px solid rgba(108,128,137,0.7)",
                borderBottom: "1.5px solid rgba(108,128,137,0.7)",
              }}
            />

            {/* Playhead */}
            <div
              className="absolute inset-y-0 pointer-events-none z-30 flex flex-col items-center"
              style={{ left: `${headPct}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-0.5 h-full bg-white/90" />
              <div className="absolute top-0 w-2 h-2 bg-white rounded-full"
                style={{ transform: "translateX(-50%) translateY(-1px)", left: "50%" }}
              />
            </div>

            {/* ─ Start Handle ─ */}
            <div
              onMouseDown={startDrag("start")}
              className="absolute inset-y-0 z-40 flex items-center cursor-ew-resize"
              style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div
                className="w-4 h-full flex flex-col items-center justify-center gap-0.5 rounded-sm relative"
                style={{
                  background: "rgba(108,128,137,0.95)",
                  boxShadow: "0 0 10px rgba(108,128,137,0.6), inset 0 0 0 1px rgba(255,255,255,0.2)"
                }}
              >
                <GripVertical className="h-4 w-4 text-black/50" />
                {/* Label */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-ocean-400 whitespace-nowrap">
                  IN
                </div>
                {/* Triangle pointer */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-0 h-0"
                  style={{
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderLeft: "5px solid rgba(108,128,137,0.95)"
                  }}
                />
              </div>
            </div>

            {/* ─ End Handle ─ */}
            <div
              onMouseDown={startDrag("end")}
              className="absolute inset-y-0 z-40 flex items-center cursor-ew-resize"
              style={{ left: `${endPct}%`, transform: "translateX(-50%)" }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="w-4 h-full flex flex-col items-center justify-center gap-0.5 rounded-sm relative"
                style={{
                  background: "rgba(108,128,137,0.95)",
                  boxShadow: "0 0 10px rgba(108,128,137,0.6), inset 0 0 0 1px rgba(255,255,255,0.2)"
                }}
              >
                <GripVertical className="h-4 w-4 text-black/50" />
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-ocean-400 whitespace-nowrap">
                  OUT
                </div>
                {/* Triangle pointer */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0"
                  style={{
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "5px solid rgba(108,128,137,0.95)"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Time info bar */}
          <div className="flex justify-between items-center mt-6 px-1">
            {/* Start time */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{t('dl_cut_start')}</span>
              <span className="font-mono text-xs text-ocean-400 font-bold">{fmt(startSec)}</span>
            </div>

            {/* Current / Duration */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{t('dl_cut_duration')}</span>
              <span className="font-mono text-xs text-white font-bold">{fmt(trimDuration)}</span>
            </div>

            {/* Current playback */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{t('dl_cut_position')}</span>
              <span className="font-mono text-xs text-zinc-400">{fmt(currentSec)}</span>
            </div>

            {/* End time */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">{t('dl_cut_end')}</span>
              <span className="font-mono text-xs text-ocean-400 font-bold">{fmt(endSec)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07]">
          <p className="text-[11px] text-zinc-600">
            {duration > 0 ? t('dl_cut_full_dur', { dur: fmt(duration) }) : t('dl_cut_loading')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              {t('dl_cancel')}
            </button>
            <button
              onClick={handleCut}
              disabled={cutting || duration === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ocean-500 text-black text-xs font-extrabold cursor-pointer disabled:opacity-40 hover:bg-ocean-400 transition"
              style={{ boxShadow: "0 0 18px rgba(108,128,137,0.35)" }}
            >
              {cutting
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('dl_cutting')}</>
                : <><Scissors className="h-3.5 w-3.5" /> {t('dl_cut_confirm')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Inline Trim Slider (for pre-download trim) ───────────────────────────────

interface TrimSliderInlineProps {
  duration: number;
  startSec: number;
  endSec: number;
  trimStart: string;
  trimEnd: string;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
}

const TrimSliderInline = memo(({
  duration, startSec, endSec, trimStart, trimEnd, onStartChange, onEndChange
}: TrimSliderInlineProps) => {
  const { t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(startSec);
  const endRef = useRef(endSec);

  useEffect(() => { startRef.current = startSec; }, [startSec]);
  useEffect(() => { endRef.current = endSec; }, [endSec]);

  const startDrag = useCallback((handle: "start" | "end") =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      const onMove = (ev: MouseEvent) => {
        const track = trackRef.current;
        if (!track || !duration) return;
        const rect = track.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
        const t = pct * duration;
        if (handle === "start") {
          const clamped = Math.min(t, endRef.current - 0.5);
          startRef.current = clamped;
          onStartChange(clamped);
        } else {
          const clamped = Math.max(t, startRef.current + 0.5);
          endRef.current = clamped;
          onEndChange(clamped);
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }, [duration, onStartChange, onEndChange]);

  const leftPct = (startSec / duration) * 100;
  const endPct = (endSec / duration) * 100;
  const trimDuration = Math.max(0, endSec - startSec);

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Timeline */}
      <div
        ref={trackRef}
        className="relative rounded-lg overflow-hidden cursor-crosshair"
        style={{ height: "52px" }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(10,13,15,0.85)" }} />
        <FakeWaveform />
        {/* Dim before start */}
        <div className="absolute inset-y-0 left-0 pointer-events-none z-10"
          style={{ width: `${leftPct}%`, background: "rgba(0,0,0,0.7)" }} />
        {/* Dim after end */}
        <div className="absolute inset-y-0 right-0 pointer-events-none z-10"
          style={{ width: `${100 - endPct}%`, background: "rgba(0,0,0,0.7)" }} />
        {/* Selected region */}
        <div className="absolute inset-y-0 pointer-events-none z-20"
          style={{
            left: `${leftPct}%`, width: `${endPct - leftPct}%`,
            background: "rgba(108,128,137,0.1)",
            borderTop: "1.5px solid rgba(108,128,137,0.6)",
            borderBottom: "1.5px solid rgba(108,128,137,0.6)",
          }} />
        {/* Start handle */}
        <div onMouseDown={startDrag("start")}
          className="absolute inset-y-0 z-40 flex items-center cursor-ew-resize"
          style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-3 h-full rounded-sm flex items-center justify-center"
            style={{ background: "rgba(108,128,137,0.9)", boxShadow: "0 0 8px rgba(108,128,137,0.5)" }}>
            <GripVertical className="h-3 w-3 text-black/50" />
          </div>
        </div>
        {/* End handle */}
        <div onMouseDown={startDrag("end")}
          className="absolute inset-y-0 z-40 flex items-center cursor-ew-resize"
          style={{ left: `${endPct}%`, transform: "translateX(-50%)" }}
          onClick={e => e.stopPropagation()}>
          <div className="w-3 h-full rounded-sm flex items-center justify-center"
            style={{ background: "rgba(108,128,137,0.9)", boxShadow: "0 0 8px rgba(108,128,137,0.5)" }}>
            <GripVertical className="h-3 w-3 text-black/50" />
          </div>
        </div>
      </div>
      {/* Time info */}
      <div className="flex justify-between px-1">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t('dl_cut_start')}</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{trimStart}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t('dl_trim_duration')}</span>
          <span className="text-[11px] font-mono font-bold text-white">{fmt(trimDuration)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t('dl_cut_end')}</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-secondary)" }}>{trimEnd}</span>
        </div>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

interface DownloaderTabProps {
  onDownloadComplete?: (filePath: string, title: string) => void;
}

export const DownloaderTab = ({ onDownloadComplete }: DownloaderTabProps) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("mp4");
  const [quality, setQuality] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [cookiesFrom, setCookiesFrom] = useState("");
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [trimStart, setTrimStart] = useState("00:00:00");
  const [trimEnd, setTrimEnd] = useState("");
  // Numeric seconds for the visual trim slider
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(0);
  // Persistent output directory (saved in localStorage)
  const [outputDir, setOutputDir] = useState<string>(
    () => localStorage.getItem("dl_output_dir") || ""
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeDownload, setActiveDownload] = useState<QueueItem | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"queue" | "history">("queue");
  const [playlistModal, setPlaylistModal] = useState<VideoMetadata | null>(null);
  const [cutItem, setCutItem] = useState<HistoryItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [downloading, setDownloading] = useState(false);
  // History selection mode
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [selectedHistoryIndices, setSelectedHistoryIndices] = useState<Set<number>>(new Set());

  const activeDownloadRef = useRef<QueueItem | null>(null);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const processingRef = useRef(false);
  const historyRef = useRef<HistoryItem[]>([]);

  activeDownloadRef.current = activeDownload;
  historyRef.current = history;

  // ── Toast ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = genId();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Persistence ──────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const h = localStorage.getItem("dl_history");
      if (h) {
        const parsed = JSON.parse(h);
        setHistory(parsed);
      }
    } catch { }
  }, []);

  const saveHistory = useCallback((items: HistoryItem[]) => {
    const capped = items.slice(0, 30);
    setHistory(capped);
    historyRef.current = capped;
    localStorage.setItem("dl_history", JSON.stringify(capped));
  }, []);

  // ── Tauri event listeners ────────────────────────────────────────────────

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const u1 = await listen<ProgressPayload>("dl-progress", e => {
        const { pct, speed, eta } = e.payload;
        setQueue(prev =>
          prev.map(item =>
            item.status === "downloading"
              ? { ...item, progress: pct, speed, eta }
              : item
          )
        );
      });

      const u2 = await listen("dl-complete", () => {
        const active = activeDownloadRef.current;
        if (!active) return;

        showToast(`${t('dl_success_prefix')} "${active.title}"`, "success");

        const filePath = active.outputPath ||
          `${active.title}.${active.format}`;
        const newEntry: HistoryItem = {
          title: active.title,
          format: active.format,
          quality: active.quality,
          filePath,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveHistory([newEntry, ...historyRef.current]);
        setQueue(prev => prev.filter(i => i.id !== active.id));
        setActiveDownload(null);
        setDownloading(false);
        processingRef.current = false;
        // Notify parent to navigate to library tab
        if (onDownloadComplete) {
          onDownloadComplete(filePath, active.title);
        }
        setTimeout(() => triggerProcessQueue(), 100);
      });

      const u3 = await listen<string>("dl-error", e => {
        const active = activeDownloadRef.current;
        if (!active) return;
        showToast(`${t('dl_fail_prefix')} ${e.payload}`, "error");
        setQueue(prev =>
          prev.map(i =>
            i.id === active.id
              ? { ...i, status: "failed", speed: "--", eta: "--" }
              : i
          )
        );
        setActiveDownload(null);
        setDownloading(false);
        processingRef.current = false;
        setTimeout(() => triggerProcessQueue(), 100);
      });

      unlisteners.push(u1, u2, u3);
    };

    setup().catch(console.error);
    return () => unlisteners.forEach(u => u());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Queue processor ──────────────────────────────────────────────────────

  const triggerProcessQueue = useCallback(() => {
    setQueue(current => {
      if (processingRef.current) return current;
      const next = current.find(i => i.status === "pending");
      if (!next) return current;

      processingRef.current = true;
      const updated = { ...next, status: "downloading" as const };
      setActiveDownload(updated);

      invoke("download_video", {
        payload: {
          url: next.url,
          format: next.format,
          quality: next.quality,
          download_dir: null,
          output_path: next.outputPath,
          start_time: next.startTime,
          end_time: next.endTime,
          cookies_from: next.cookiesFrom || "",
        },
      }).catch(err => {
        showToast(`${t('dl_error_prefix')} ${err}`, "error");
        setQueue(prev =>
          prev.map(i => i.id === next.id ? { ...i, status: "failed" } : i)
        );
        setActiveDownload(null);
        processingRef.current = false;
      });

      return current.map(i => i.id === next.id ? updated : i);
    });
  }, [showToast]);

  const addToQueue = useCallback((item: Omit<QueueItem, "id" | "status" | "progress" | "speed" | "eta">) => {
    const fullItem: QueueItem = {
      ...item,
      id: genId(),
      status: "pending",
      progress: 0,
      speed: "--",
      eta: "--",
    };
    setQueue(prev => {
      const next = [...prev, fullItem];
      if (!processingRef.current) setTimeout(() => triggerProcessQueue(), 50);
      return next;
    });
  }, [triggerProcessQueue]);

  // ── Select output directory ───────────────────────────────────────────────

  const handleSelectDir = async () => {
    try {
      const dir = await invoke<string | null>("select_save_dir");
      if (dir) {
        setOutputDir(dir);
        localStorage.setItem("dl_output_dir", dir);
      }
    } catch (err: any) {
      showToast(`${t('dl_dir_error')} ${err}`, "error");
    }
  };

  // ── URL probing ──────────────────────────────────────────────────────────

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setMetadata(null);
    setQuality("");
    setProbeError("");
    if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    if (!isValidUrl(value)) return;

    probeTimerRef.current = setTimeout(async () => {
      setProbing(true);
      try {
        const result = await invoke<VideoMetadata>("probe_video", {
          url: value,
          cookies_from: cookiesFrom || null,
        });
        if (result.is_playlist) {
          setPlaylistModal(result);
        } else {
          setMetadata(result);
          // Initialize trim slider to full duration
          if (result.duration) {
            setTrimStartSec(0);
            setTrimEndSec(result.duration);
            setTrimStart("00:00:00");
            setTrimEnd(fmt(result.duration));
          }
          const firstQ = format === "mp4"
            ? result.video_qualities[0]?.id
            : result.audio_qualities[0]?.id;
          setQuality(firstQ || "");
          showToast(`📋 "${result.title}"`, "success");
        }
      } catch (err: any) {
        setProbeError(`${t('dl_probe_fail')} ${err}`);
      } finally {
        setProbing(false);
      }
    }, 900);
  };

  const handleFormatChange = (f: string) => {
    setFormat(f);
    if (metadata) {
      const firstQ = f === "mp4"
        ? metadata.video_qualities[0]?.id
        : metadata.audio_qualities[0]?.id;
      setQuality(firstQ || "");
    }
  };

  // ── Start Download — uses persistent outputDir ───────────────────────────

  const handleStartDownload = async () => {
    if (!metadata || !quality || downloading) return;
    if (!outputDir) {
      showToast(t('dl_req_dir'), "error");
      return;
    }

    const fileName = `${sanitize(metadata.title)}.${format}`;
    // Build full output path: dir + separator + filename
    const sep = outputDir.includes("\\") ? "\\" : "/";
    const outputPath = `${outputDir}${sep}${fileName}`;

    addToQueue({
      title: metadata.title,
      url,
      format,
      quality,
      outputPath,
      startTime: trimEnabled ? trimStart : null,
      endTime: trimEnabled ? trimEnd : null,
      cookiesFrom,
    });

    // Reset form
    setUrl("");
    setMetadata(null);
    setQuality("");
    setTrimEnabled(false);
    setTrimStartSec(0);
    setTrimEndSec(0);
    setTrimStart("00:00:00");
    setTrimEnd("");
    setSidebarTab("queue");
  };

  const handleCancelDownload = async () => {
    try { await invoke("cancel_download"); showToast(t('dl_cancel_msg'), "info"); }
    catch { }
  };

  const handleRemoveItem = async (item: QueueItem) => {
    if (item.status === "downloading") await handleCancelDownload();
    else setQueue(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDeleteSelectedHistory = useCallback(() => {
    if (selectedHistoryIndices.size === 0) return;
    const remaining = history.filter((_, i) => !selectedHistoryIndices.has(i));
    saveHistory(remaining);
    setSelectedHistoryIndices(new Set());
    setHistorySelectMode(false);
  }, [history, selectedHistoryIndices, saveHistory]);

  const qualityOptions = metadata
    ? (format === "mp4" ? metadata.video_qualities : metadata.audio_qualities)
    : [];

  const activeCount = queue.filter(i => i.status === "pending" || i.status === "downloading").length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-6 py-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">

        {/* Header */}
        <div dir="rtl" className="flex items-center justify-between">
          <div />
          <div className="text-right">
            <h1 className="text-2xl font-bold flex items-center gap-3 justify-end text-[var(--text-primary)]">
              {t('dl_title')}
              <div className="p-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]">
                <Download className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 w-full" dir="rtl">
              {TOP_SITES.map(site => (
                <div 
                  key={site.name} 
                  className="w-8 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--accent-hover)] hover:bg-[var(--bg-panel)] transition-all duration-150 flex items-center justify-center cursor-help shadow-sm active:scale-95" 
                  title={site.name}
                  dangerouslySetInnerHTML={{ __html: site.svg }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* URL Card */}
        <div className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] shadow-md">

          {/* ── Section: URL Input ─────────────────────────────────── */}
          <div className="p-3.5 flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-right" style={{ color: "var(--text-muted)" }} dir="rtl">{t('dl_url_label')}</p>

            {/* URL input */}
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={e => handleUrlChange(e.target.value)}
                onPaste={e => setTimeout(() => handleUrlChange(e.currentTarget.value), 30)}
                placeholder={t('dl_url_placeholder')}
                dir="rtl"
                className="w-full rounded-xl px-4 py-3 pr-11 text-white text-right text-sm placeholder-zinc-600 focus:outline-none transition-colors"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
              />
              {url && (
                <button
                  onClick={() => { setUrl(""); setMetadata(null); setProbeError(""); }}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {probing && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-secondary)" }} />
                </div>
              )}
            </div>

            {/* Error */}
            {probeError && (
              <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" dir="rtl"
                style={{ background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.25)", color: "var(--text-primary)" }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{probeError}</span>
              </div>
            )}

            {/* Video preview */}
            {metadata && (
              <div className="flex items-center gap-4 rounded-xl p-3" dir="rtl"
                style={{ background: "rgba(108,128,137,0.07)", border: "1px solid rgba(108,128,137,0.2)" }}>
                {metadata.thumbnail && (
                  <img
                    src={metadata.thumbnail}
                    alt=""
                    className="w-16 h-11 object-cover rounded-lg flex-shrink-0"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{metadata.title}</p>
                  {metadata.duration && (
                    <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--text-secondary)" }}>
                      ⏱ {fmt(metadata.duration)}
                    </p>
                  )}
                </div>
                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#6ab08a" }} />
              </div>
            )}


          </div>



          {/* ── Section: Format / Quality / Cookies ─────────────────── */}
          <div className="p-3.5 flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-right" style={{ color: "var(--text-muted)" }} dir="rtl">{t('dl_settings')}</p>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: t('dl_format'), value: format, onChange: handleFormatChange,
                  options: [{ v: "mp4", l: t('dl_fmt_video') }, { v: "mp3", l: t('dl_fmt_audio') }]
                },
                {
                  label: t('dl_quality'), value: quality, onChange: setQuality,
                  options: qualityOptions.length
                    ? qualityOptions.map(q => ({ v: q.id, l: q.label }))
                    : [{ v: "", l: t('dl_qual_empty') }],
                  disabled: qualityOptions.length === 0
                },
                {
                  label: t('dl_cookies'), value: cookiesFrom, onChange: setCookiesFrom,
                  options: [
                    { v: "", l: t('dl_cookies_none') },
                    { v: "chrome", l: "Chrome" },
                    { v: "edge", l: "Edge" },
                    { v: "firefox", l: "Firefox" },
                    { v: "brave", l: "Brave" },
                  ]
                }
              ].map(({ label, value, onChange, options, disabled }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-right tracking-wide" dir="rtl"
                    style={{ color: "var(--text-secondary)" }}>{label}</label>
                  <div className="relative">
                    <select
                      value={value}
                      onChange={e => (onChange as (v: string) => void)(e.target.value)}
                      disabled={disabled}
                      className="w-full appearance-none rounded-xl px-3 py-2.5 pr-8 text-sm text-white focus:outline-none transition-colors cursor-pointer disabled:opacity-40"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)" }}
                    >
                      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

          {/* ── Section: Trim toggle ─────────────────────────────────── */}
          <div className="px-3.5 py-2.5 flex flex-col gap-2">
            <label className="flex items-center justify-between cursor-pointer select-none" dir="rtl">
              <div
                onClick={() => setTrimEnabled(v => !v)}
                className="relative cursor-pointer flex-shrink-0"
                style={{
                  width: "38px", height: "20px",
                  borderRadius: "10px",
                  background: trimEnabled ? "#38bdf8" : "rgba(255,255,255,0.1)",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: "3px",
                  left: trimEnabled ? "21px" : "3px",
                  width: "14px", height: "14px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                }} />
              </div>
              <span className="text-sm" style={{ color: trimEnabled ? "var(--text-primary)" : "var(--text-muted)" }}>
                {t('dl_enable_trim')}
              </span>
            </label>

            {trimEnabled && metadata?.duration && metadata.duration > 0 ? (
              <TrimSliderInline
                duration={metadata.duration}
                startSec={trimStartSec}
                endSec={trimEndSec}
                onStartChange={(v) => { setTrimStartSec(v); setTrimStart(fmt(v)); }}
                onEndChange={(v) => { setTrimEndSec(v); setTrimEnd(fmt(v)); }}
                trimStart={trimStart}
                trimEnd={trimEnd}
              />
            ) : trimEnabled ? (
              <div className="grid grid-cols-2 gap-3" dir="rtl">
                {[
                  { label: t('dl_trim_start'), value: trimStart, onChange: setTrimStart, placeholder: "00:00:00" },
                  { label: t('dl_trim_end'), value: trimEnd, onChange: setTrimEnd, placeholder: "00:01:30" },
                ].map(({ label, value, onChange, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      placeholder={placeholder}
                      className="rounded-lg px-3 py-2 text-sm text-white font-mono text-center focus:outline-none"
                      style={{ background: "rgba(10,13,15,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── Divider ─────────────────────────────────────────────── */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

          {/* ── Section: Output Folder + Download Button ─────────────── */}
          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-right" style={{ color: "var(--text-muted)" }} dir="rtl">{t('dl_save_dir')}</p>

            {/* Folder bar */}
            <button
              onClick={handleSelectDir}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer"
              style={{
                background: "rgba(10,13,15,0.7)",
                border: outputDir ? "1px solid rgba(108,128,137,0.3)" : "1px dashed rgba(255,255,255,0.1)",
              }}
            >
              <Folder className="h-4 w-4 flex-shrink-0" style={{ color: outputDir ? "#38bdf8" : "#3a4a50" }} />
              <span className="flex-1 truncate text-right text-xs" dir="rtl"
                style={{ color: outputDir ? "#8ba2ad" : "#3a4a50" }}>
                {outputDir || t('dl_select_dir')}
              </span>
              {outputDir && (
                <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{t('dl_change')}</span>
              )}
            </button>

            {/* Start Download button */}
            <button
              onClick={handleStartDownload}
              disabled={!metadata || !quality || downloading || !outputDir}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm cursor-pointer disabled:cursor-not-allowed transition-all"
              style={{
                fontWeight: 700,
                background: (!metadata || !quality || downloading || !outputDir)
                  ? "rgba(108,128,137,0.12)"
                  : "linear-gradient(135deg, #7dd3fc 0%, #4e6168 100%)",
                color: (!metadata || !quality || downloading || !outputDir) ? "#3a4a50" : "#fff",
                border: "1px solid rgba(108,128,137,0.2)",
                boxShadow: (!metadata || !quality || downloading || !outputDir)
                  ? "none"
                  : "0 4px 20px rgba(108,128,137,0.28)",
              }}
            >
              {downloading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('dl_downloading')}</>
                : <><Download className="h-4 w-4" /> {t('dl_start_dl')}</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-[240px] flex-shrink-0 flex flex-col min-h-0 border-l border-[var(--border-color)] bg-[var(--bg-panel)] shadow-lg">

        {/* Tabs */}
        <div className="flex items-center border-b border-[var(--border-color)]">
          {([
            { id: "queue", icon: List, label: t('dl_tab_queue'), count: activeCount },
            { id: "history", icon: History, label: t('dl_tab_history') },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => { setSidebarTab(tab.id); setHistorySelectMode(false); setSelectedHistoryIndices(new Set()); }}
              className="flex-1 py-3.5 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer relative"
              style={{ color: sidebarTab === tab.id ? "var(--accent-primary)" : "var(--text-muted)" }}
            >
              {sidebarTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--accent-primary)] shadow-sm" />
              )}
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {"count" in tab && tab.count > 0 && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-[var(--color-charcoal)]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          {/* Select mode toggle — only in history tab with items */}
          {sidebarTab === "history" && history.length > 0 && (
            <button
              onClick={() => {
                setHistorySelectMode(v => !v);
                setSelectedHistoryIndices(new Set());
              }}
              className="px-3 py-3.5 text-[10px] font-bold transition cursor-pointer flex-shrink-0"
              style={{ color: historySelectMode ? "#c07070" : "#4a6068" }}
            >
              {historySelectMode ? t('dl_cancel_select') : t('dl_select')}
            </button>
          )}
        </div>

        {/* Sidebar body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">

          {/* Queue */}
          {sidebarTab === "queue" && (
            <>
              {activeDownload && (
                <button
                  onClick={handleCancelDownload}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition cursor-pointer mb-1"
                  style={{
                    background: "rgba(100,30,30,0.18)",
                    border: "1px solid rgba(160,50,50,0.25)",
                    color: "#e07070",
                  }}
                >
                  <Square className="h-3 w-3" /> {t('dl_stop_current')}
                </button>
              )}
              {queue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
                  <Download className="h-9 w-9 mb-3 opacity-30" />
                  <p className="text-xs">{t('dl_queue_empty')}</p>
                </div>
              ) : queue.map(item => (
                <div key={item.id} className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-start gap-2 mb-2">
                    {item.format === "mp4"
                      ? <FileVideo className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                      : <Music className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                    <div className="flex-1 min-w-0 text-right" dir="rtl">
                      <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                      <p className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        {item.format} • {item.quality}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="transition flex-shrink-0 cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#c07070")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#3a4a50")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Progress */}
                  <div className="h-0.5 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.status === "done" ? 100 : item.progress}%`,
                        background: item.status === "done" ? "#5a9a70"
                          : item.status === "failed" ? "#9a4040"
                          : "linear-gradient(90deg, #4a6878, #38bdf8)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-mono" style={{
                      color: item.status === "downloading" ? "#38bdf8"
                        : item.status === "done" ? "#5a9a70"
                        : item.status === "failed" ? "#9a5050"
                        : "#3a4a50"
                    }}>
                      {item.status === "downloading" ? `${Math.round(item.progress)}% • ${item.speed}`
                        : item.status === "done" ? t('dl_status_done')
                        : item.status === "failed" ? t('dl_status_fail')
                        : t('dl_status_pending')}
                    </span>
                    {item.status === "downloading" && item.eta !== "--" && (
                      <span className="font-mono" style={{ color: "var(--text-muted)" }}>ETA {item.eta}</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* History */}
          {sidebarTab === "history" && (
            <>
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16" style={{ color: "var(--text-muted)" }}>
                  <History className="h-9 w-9 mb-3 opacity-30" />
                  <p className="text-xs">{t('dl_history_empty')}</p>
                </div>
              ) : (
                <>
                  {/* Select all bar */}
                  {historySelectMode && (
                    <button
                      onClick={() => {
                        if (selectedHistoryIndices.size === history.length) {
                          setSelectedHistoryIndices(new Set());
                        } else {
                          setSelectedHistoryIndices(new Set(history.map((_, i) => i)));
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer mb-1"
                      style={{
                        background: "rgba(108,128,137,0.06)",
                        border: "1px solid rgba(108,128,137,0.12)",
                        color: "var(--text-secondary)",
                      }}
                      dir="rtl"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: selectedHistoryIndices.size === history.length ? "#38bdf8" : "transparent",
                          border: "1.5px solid #38bdf8",
                        }}
                      >
                        {selectedHistoryIndices.size === history.length && (
                          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0a0e10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {t('dl_select_all', { count: history.length })}
                    </button>
                  )}

                  {/* History items */}
                  {history.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3 transition-all"
                      style={{
                        background: historySelectMode && selectedHistoryIndices.has(i)
                          ? "rgba(108,128,137,0.1)"
                          : "rgba(255,255,255,0.03)",
                        border: historySelectMode && selectedHistoryIndices.has(i)
                          ? "1px solid rgba(108,128,137,0.3)"
                          : "1px solid rgba(255,255,255,0.05)",
                        cursor: historySelectMode ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (!historySelectMode) return;
                        setSelectedHistoryIndices(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-start gap-2 mb-2.5" dir="rtl">
                        {/* Checkbox in select mode */}
                        {historySelectMode ? (
                          <div
                            className="w-3.5 h-3.5 rounded mt-0.5 flex-shrink-0 flex items-center justify-center"
                            style={{
                              background: selectedHistoryIndices.has(i) ? "#38bdf8" : "transparent",
                              border: "1.5px solid " + (selectedHistoryIndices.has(i) ? "#38bdf8" : "#3a4a50"),
                            }}
                          >
                            {selectedHistoryIndices.has(i) && (
                              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#0a0e10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        ) : (
                          item.format === "mp4"
                            ? <FileVideo className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                            : <Music className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {item.format.toUpperCase()} • {item.quality} • {item.timestamp}
                          </p>
                        </div>
                      </div>
                      {!historySelectMode && (
                        <button
                          onClick={() => setCutItem(item)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer font-semibold"
                          style={{
                            background: "rgba(108,128,137,0.06)",
                            border: "1px solid rgba(108,128,137,0.12)",
                            color: "#4a6068",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(108,128,137,0.12)";
                            (e.currentTarget as HTMLElement).style.color = "#8ba2ad";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(108,128,137,0.06)";
                            (e.currentTarget as HTMLElement).style.color = "#4a6068";
                          }}
                        >
                          <Scissors className="h-3 w-3" /> {t('dl_cut_file')}
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Delete selected button */}
                  {historySelectMode && selectedHistoryIndices.size > 0 && (
                    <button
                      onClick={handleDeleteSelectedHistory}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer mt-1 sticky bottom-2"
                      style={{
                        background: "rgba(160,50,50,0.18)",
                        border: "1px solid rgba(200,70,70,0.3)",
                        color: "#e07070",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> {t('dl_delete_selected', { count: selectedHistoryIndices.size })}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Playlist Modal ─────────────────────────────────────────────────── */}
      {playlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <button onClick={() => { setPlaylistModal(null); setUrl(""); }} className="text-zinc-500 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
              <div className="text-right">
                <h3 className="text-sm font-bold text-white">{t('dl_playlist')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t('dl_playlist_videos', { count: playlistModal.entries?.length || 0, title: playlistModal.title })}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto flex flex-col gap-1 custom-scrollbar max-h-56">
              {playlistModal.entries?.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-zinc-900/60 rounded-lg" dir="rtl">
                  <span className="text-[10px] font-mono text-zinc-600 w-5 text-center">{i + 1}</span>
                  <span className="text-xs text-zinc-300 truncate">{e.title}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end border-t border-white/[0.07] pt-4">
              <button
                onClick={() => { setPlaylistModal(null); setUrl(""); }}
                className="px-4 py-2 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                {t('dl_cancel')}
              </button>
              <button
                onClick={async () => {
                  const fmt_ = format;
                  const q = fmt_ === "mp4" ? "720p" : "192k";
                  for (const e of (playlistModal.entries || [])) {
                    addToQueue({
                      title: e.title, url: e.url, format: fmt_, quality: q,
                      outputPath: null, startTime: null, endTime: null, cookiesFrom,
                    });
                  }
                  showToast(t('dl_added_count', { count: playlistModal.entries?.length || 0 }), "success");
                  setPlaylistModal(null); setUrl("");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-500 text-black text-xs font-extrabold cursor-pointer hover:bg-ocean-400"
              >
                <Download className="h-3.5 w-3.5" /> {t('dl_add_all')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cut Modal ─────────────────────────────────────────────────────── */}
      {cutItem && (
        <CutModal
          item={cutItem}
          onClose={() => setCutItem(null)}
          onToast={showToast}
        />
      )}

      {/* ── Toasts ────────────────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};


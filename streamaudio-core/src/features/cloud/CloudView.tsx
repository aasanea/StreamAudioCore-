import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Check, Link2Off, Link, Download, Upload, Star,
  ArrowDownToLine, Sparkles, Package, Wifi, WifiOff, ShieldCheck,
  AlertCircle, CheckCircle2, Loader2, Music2
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Config, CommunityPack, SyncReport } from '../../types';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { Typography } from '../../components/ui/Typography';
import { useAppVersion } from '../../hooks/useAppVersion';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string | null;
  release_notes: string | null;
  download_size: string | null;
}

interface SoundPackItem {
  id: string;
  title: string;
  description: string;
  version: string;
  size_bytes: number;
  size_display: string;
  category: string;
  tags: string[];
  download_url: string;
  author: string;
  downloads: number;
  rating: number;
}

interface DownloadProgressEvent {
  pack_id: string;
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  status: 'downloading' | 'installing' | 'done' | 'error';
}

interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'up_to_date' | 'downloading' | 'installing' | 'restart' | 'error';
  info: UpdateInfo | null;
  downloadProgress: number;
  error: string | null;
}

// ─── CloudView Props (same interface, backwards-compatible) ────────────────────

export interface CloudData {
  config: Config;
  communityPacks: CommunityPack[];
  loadingPacks: boolean;
}

export interface CloudActions {
  handleRatePack: (id: string, rating: number) => void;
  handleInstallCommunityPack: (url: string) => void;
  handleImportPack: () => void;
}

export interface SyncState {
  syncReport: SyncReport | null;
  syncing: boolean;
  dropboxCode: string;
  setDropboxCode: (val: string) => void;
  handleUnlinkDropbox: () => void;
  handleGetAuthCode: () => void;
  handleExchangeCode: () => void;
  handleSyncNow: () => void;
}

export interface PublishState {
  publishTitle: string;
  setPublishTitle: (val: string) => void;
  publishDesc: string;
  setPublishDesc: (val: string) => void;
  selectedSoundsForPack: Record<string, boolean>;
  setSelectedSoundsForPack: (val: Record<string, boolean>) => void;
  publishingPack: boolean;
  handlePublishPack: () => void;
}

export interface CloudViewProps {
  cloudData: CloudData;
  cloudActions: CloudActions;
  syncState: SyncState;
  publishState: PublishState;
}

// ─── UpdaterCard Component ─────────────────────────────────────────────────────

const UpdaterCard: React.FC = () => {
  const appVersion = useAppVersion();
  const [state, setState] = useState<UpdaterStatus>({
    status: 'idle',
    info: null,
    downloadProgress: 0,
    error: null,
  });

  // Listen to tauri updater events
  useEffect(() => {
    const unlistenStatus = listen<{ status: string; message: string }>('updater://status', (event) => {
      const { status } = event.payload;
      if (status === 'downloading') setState(s => ({ ...s, status: 'downloading' }));
      if (status === 'installing') setState(s => ({ ...s, status: 'installing' }));
      if (status === 'restart') setState(s => ({ ...s, status: 'restart' }));
    });

    const unlistenProgress = listen<{ downloaded: number; total: number }>('updater://progress', (event) => {
      const { downloaded, total } = event.payload;
      if (total > 0) {
        setState(s => ({ ...s, downloadProgress: Math.round((downloaded / total) * 100) }));
      }
    });

    return () => {
      unlistenStatus.then(fn => fn());
      unlistenProgress.then(fn => fn());
    };
  }, []);

  const handleCheck = useCallback(async () => {
    setState(s => ({ ...s, status: 'checking', error: null }));
    try {
      const info = await invoke<UpdateInfo>('check_for_updates');
      setState(s => ({
        ...s,
        status: info.available ? 'available' : 'up_to_date',
        info,
      }));
    } catch (e) {
      setState(s => ({ ...s, status: 'error', error: String(e) }));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    setState(s => ({ ...s, status: 'downloading', downloadProgress: 0 }));
    try {
      await invoke('install_update');
    } catch (e) {
      setState(s => ({ ...s, status: 'error', error: String(e) }));
    }
  }, []);

  const renderStatusBadge = () => {
    switch (state.status) {
      case 'up_to_date':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle2 size={13} /> محدَّث
          </span>
        );
      case 'available':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            <Sparkles size={13} /> تحديث متاح
          </span>
        );
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-white/5 text-zinc-400 border border-white/10">
            <Loader2 size={13} className="animate-spin" /> جاري الفحص...
          </span>
        );
      case 'downloading':
      case 'installing':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-ocean-500/20 text-ocean-400 border border-ocean-500/30">
            <Loader2 size={13} className="animate-spin" />
            {state.status === 'downloading' ? `تحميل ${state.downloadProgress}%` : 'جاري التثبيت...'}
          </span>
        );
      case 'restart':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle2 size={13} /> اكتمل التحديث!
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            <AlertCircle size={13} /> خطأ
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-white/5 text-zinc-400 border border-white/10">
            <ShieldCheck size={13} /> الإصدار {appVersion}
          </span>
        );
    }
  };

  const isProcessing = ['checking', 'downloading', 'installing'].includes(state.status);

  return (
    <GlassPanel intensity="low" className="p-6 flex flex-col gap-4 border-ocean-500/10 hover:border-ocean-400/20 transition-all duration-300">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        {renderStatusBadge()}
        <Typography variant="h3" color="primary" className="flex items-center gap-2">
          <ArrowDownToLine size={18} className="text-ocean-400" /> تحديثات التطبيق
        </Typography>
      </div>

      {/* Current version */}
      <div className="flex justify-between items-center text-sm" dir="rtl">
        <span className="text-zinc-400">الإصدار الحالي:</span>
        <span className="font-mono text-ocean-300 font-bold bg-ocean-500/10 px-3 py-1 rounded-lg border border-ocean-500/20">
          {state.info?.current_version || appVersion.replace('v', '')}
        </span>
      </div>

      {/* Latest version (when available) */}
      {state.info?.available && state.info.latest_version && (
        <div className="flex justify-between items-center text-sm" dir="rtl">
          <span className="text-zinc-400">الإصدار الجديد:</span>
          <span className="font-mono text-amber-300 font-bold bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
            {state.info.latest_version}
          </span>
        </div>
      )}

      {/* Release notes */}
      {state.info?.release_notes && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 text-right leading-relaxed" dir="rtl">
          <p className="text-xs text-zinc-500 font-bold mb-2">ملاحظات الإصدار:</p>
          <p>{state.info.release_notes}</p>
        </div>
      )}

      {/* Download progress bar */}
      {(state.status === 'downloading') && (
        <div className="flex flex-col gap-2">
          <div className="w-full bg-black/40 rounded-full h-2 border border-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ocean-500 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              style={{ width: `${state.downloadProgress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 text-right" dir="rtl">
            جاري تحميل التحديث... {state.downloadProgress}%
          </p>
        </div>
      )}

      {/* Error message */}
      {state.status === 'error' && state.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-right" dir="rtl">
          {state.error.includes('No update') ? 'لم يتم العثور على تحديثات متاحة.' : state.error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-auto pt-2">
        {state.status === 'available' && (
          <Button
            variant="primary"
            onClick={handleInstall}
            disabled={isProcessing}
            className="flex-1 py-2.5 font-bold"
          >
            <Download size={15} className="ml-2" />
            تثبيت التحديث
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleCheck}
          disabled={isProcessing}
          className={state.status === 'available' ? 'py-2.5' : 'flex-1 py-2.5'}
        >
          <RefreshCw size={14} className={`ml-2 ${isProcessing ? 'animate-spin' : ''}`} />
          {state.status === 'up_to_date' ? 'أنت على أحدث إصدار' : 'فحص التحديثات'}
        </Button>
      </div>
    </GlassPanel>
  );
};

// ─── SoundPacksSection Component ───────────────────────────────────────────────

const SoundPacksSection: React.FC = () => {
  const [packs, setPacks] = useState<SoundPackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packProgress, setPackProgress] = useState<Record<string, DownloadProgressEvent>>({});

  // Listen to real-time progress events from Rust backend
  useEffect(() => {
    const unlisten = listen<DownloadProgressEvent>('sound-pack://progress', (event) => {
      const progress = event.payload;
      setPackProgress(prev => ({
        ...prev,
        [progress.pack_id]: progress,
      }));
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<SoundPackItem[]>('get_sound_packs');
      setPacks(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const handleDownload = useCallback(async (pack: SoundPackItem) => {
    try {
      await invoke<string>('download_sound_pack', {
        packId: pack.id,
        downloadUrl: pack.download_url,
      });
    } catch (e) {
      setPackProgress(prev => ({
        ...prev,
        [pack.id]: {
          pack_id: pack.id,
          downloaded_bytes: 0,
          total_bytes: 0,
          percentage: 0,
          status: 'error',
        },
      }));
    }
  }, []);

  const getPackStatus = (packId: string) => packProgress[packId]?.status;
  const getPackPct = (packId: string) => packProgress[packId]?.percentage ?? 0;

  const categoryColors: Record<string, string> = {
    'كوميدي': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'رعب': 'bg-red-500/20 text-red-400 border-red-500/30',
    'طبيعة': 'bg-green-500/20 text-green-400 border-green-500/30',
    'ألعاب': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'بث': 'bg-ocean-500/20 text-ocean-400 border-ocean-500/30',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="flex justify-between items-center">
        <button
          onClick={fetchPacks}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-ocean-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-ocean-500/10 border border-transparent hover:border-ocean-500/20"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          تحديث القائمة
        </button>
        <Typography variant="h2" color="primary" className="flex items-center justify-end gap-3">
          حزم الأصوات الاختيارية <Music2 size={22} className="text-ocean-400" />
        </Typography>
      </div>

      <p className="text-sm text-zinc-400 text-right leading-relaxed" dir="rtl">
        حزم صوتية إضافية متاحة للتحميل الاختياري. كل حزمة تُضاف تلقائياً إلى مكتبتك بعد التثبيت.
      </p>

      {/* Error state */}
      {error && (
        <GlassPanel intensity="low" className="p-6 border-red-500/20 flex flex-col items-center gap-3">
          <AlertCircle size={32} className="text-red-400 opacity-70" />
          <Typography variant="body" color="muted" className="text-center text-sm">
            تعذّر الاتصال بسيرفر الحزم. تأكد من اتصالك بالشبكة.
          </Typography>
          <button
            onClick={fetchPacks}
            className="text-xs text-ocean-400 hover:underline"
          >إعادة المحاولة</button>
        </GlassPanel>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="py-16 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-ocean-400" />
          <Typography variant="body" color="muted">جاري تحميل قائمة الحزم...</Typography>
        </div>
      )}

      {/* Empty state (No packs available) */}
      {!loading && !error && packs.length === 0 && (
        <GlassPanel intensity="low" className="py-16 px-6 flex flex-col items-center justify-center gap-4 border-ocean-500/10 text-center">
          <div className="w-16 h-16 rounded-full bg-ocean-500/10 flex items-center justify-center mb-2">
            <Package size={28} className="text-ocean-400 opacity-80" />
          </div>
          <Typography variant="h3" color="primary">
            لا توجد حزم صوتية حالياً
          </Typography>
          <div dir="rtl">
            <Typography variant="body" color="muted" className="max-w-md text-sm leading-relaxed">
              حالياً لا تتوفر أي حزم جاهزة للتحميل. قريباً سيتم تحديث الحزم وإضافة أصوات ومؤثرات جديدة ومميزة، ابقَ مترقباً!
            </Typography>
          </div>
          <Button variant="secondary" onClick={fetchPacks} className="mt-4 py-2">
            <RefreshCw size={14} className="ml-2" />
            التحقق مجدداً
          </Button>
        </GlassPanel>
      )}

      {/* Pack grid */}
      {!loading && !error && packs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packs.map(pack => {
            const status = getPackStatus(pack.id);
            const pct = getPackPct(pack.id);
            const isDone = status === 'done';
            const isError = status === 'error';
            const isActive = status === 'downloading' || status === 'installing';

            return (
              <GlassPanel
                key={pack.id}
                intensity="low"
                className="overflow-hidden flex flex-col border-white/5 hover:border-ocean-400/25 transition-all duration-300 group"
              >
                {/* Pack header stripe */}
                <div className="relative h-24 bg-gradient-to-br from-ocean-950/80 via-black/60 to-black flex-shrink-0 border-b border-white/5 overflow-hidden">
                  {/* Animated background pattern */}
                  <div className="absolute inset-0 opacity-20 mix-blend-overlay"
                    style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />
                  {/* Glow orb */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-ocean-500/20 blur-2xl group-hover:bg-ocean-400/30 transition-all duration-500" />

                  {/* Category badge */}
                  <span className={`absolute top-3 right-3 text-[10px] px-2.5 py-1 font-bold border rounded-lg backdrop-blur-md ${categoryColors[pack.category] || 'bg-white/10 text-zinc-300 border-white/10'}`}>
                    {pack.category}
                  </span>

                  {/* Size badge */}
                  <span className="absolute bottom-3 left-3 text-[11px] px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 font-mono text-zinc-300 font-bold">
                    {pack.size_display}
                  </span>

                  {/* Done checkmark */}
                  {isDone && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 size={32} className="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.6)]" />
                    </div>
                  )}
                </div>

                {/* Pack body */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="text-right">
                    <Typography variant="h3" color="primary" className="mb-1">
                      {pack.title}
                    </Typography>
                    <Typography variant="caption" color="muted" className="leading-relaxed line-clamp-2 text-xs">
                      {pack.description}
                    </Typography>
                  </div>

                  {/* Meta info */}
                  <div className="flex justify-between items-center text-xs text-zinc-500" dir="rtl">
                    <span className="flex items-center gap-1">
                      <Package size={11} />
                      الإصدار {pack.version}
                    </span>
                    <span>{pack.author}</span>
                  </div>

                  {/* Tags */}
                  {pack.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {pack.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-zinc-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Download progress bar */}
                  {isActive && (
                    <div className="flex flex-col gap-1.5">
                      <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${pct}%`,
                            background: status === 'installing'
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #0891b2, #22d3ee)',
                            boxShadow: status === 'installing'
                              ? '0 0 8px rgba(245,158,11,0.5)'
                              : '0 0 8px rgba(6,182,212,0.5)',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 text-right" dir="rtl">
                        {status === 'installing' ? 'جاري التثبيت...' : `${Math.round(pct)}%`}
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {isError && (
                    <p className="text-[10px] text-red-400 text-right">فشل التحميل. حاول مجدداً.</p>
                  )}

                  {/* Footer: rating + action button */}
                  <div className="flex justify-between items-center mt-auto pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          size={11}
                          className={star <= Math.round(pack.rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-zinc-600 fill-transparent'}
                        />
                      ))}
                      <span className="text-[10px] font-mono text-zinc-400 ml-1">
                        ({pack.rating.toFixed(1)})
                      </span>
                    </div>

                    <button
                      onClick={() => !isDone && !isActive && handleDownload(pack)}
                      disabled={isDone || isActive}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200
                        ${isDone
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 cursor-default'
                          : isActive
                          ? 'bg-white/5 text-zinc-500 border-white/10 cursor-wait'
                          : isError
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          : 'bg-ocean-500/10 text-ocean-400 border-ocean-500/20 hover:bg-ocean-500/20 hover:border-ocean-400/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        }
                      `}
                    >
                      {isDone ? (
                        <><CheckCircle2 size={12} /> مثبَّت</>
                      ) : isActive ? (
                        <><Loader2 size={12} className="animate-spin" /> {status === 'installing' ? 'يُثبَّت...' : 'يُحمَّل...'}</>
                      ) : isError ? (
                        <><RefreshCw size={12} /> إعادة</>
                      ) : (
                        <><ArrowDownToLine size={12} /> تثبيت</>
                      )}
                    </button>
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && packs.length === 0 && (
        <div className="col-span-full py-16 text-center">
          <GlassPanel intensity="low" className="inline-flex flex-col items-center justify-center p-10 border-dashed border-white/10">
            <Music2 size={40} className="text-zinc-600 mb-4 opacity-50" />
            <Typography variant="h3" color="muted">لا توجد حزم متاحة حالياً</Typography>
            <Typography variant="caption" color="muted" className="mt-2">
              سيتم إضافة حزم صوتية قريباً
            </Typography>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

// ─── Main CloudView ─────────────────────────────────────────────────────────────

export const CloudView: React.FC<CloudViewProps> = React.memo(({
  cloudData,
  cloudActions,
  syncState,
  publishState
}) => {
  const { config, communityPacks, loadingPacks } = cloudData;
  const { handleRatePack, handleInstallCommunityPack, handleImportPack } = cloudActions;
  const {
    syncReport,
    syncing,
    dropboxCode,
    setDropboxCode,
    handleUnlinkDropbox,
    handleGetAuthCode,
    handleExchangeCode,
    handleSyncNow
  } = syncState;
  const {
    publishTitle,
    setPublishTitle,
    publishDesc,
    setPublishDesc,
    selectedSoundsForPack,
    setSelectedSoundsForPack,
    publishingPack,
    handlePublishPack
  } = publishState;

  return (
    <div className="p-8 h-full flex flex-col gap-10 overflow-y-auto custom-scrollbar">

      {/* ── Page Title ──────────────────────────────────────────────── */}
      <div className="text-right w-full">
        <Typography variant="h1" color="primary">السحابة والمجتمع</Typography>
        <Typography variant="caption" color="muted" className="mt-1">
          مزامنة إعداداتك، التحديثات، وحزم الأصوات الاختيارية
        </Typography>
      </div>

      {/* ── Row 1: Sync + Updater ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sync Status Card */}
        <GlassPanel intensity="low" className="p-6 flex flex-col gap-5 border-ocean-500/10 hover:border-ocean-400/30 transition-all duration-300">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <span className={`text-xs px-3 py-1.5 rounded-lg font-bold tracking-wide flex items-center gap-1.5 ${config.cloud_provider ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
              {config.cloud_provider ? <Wifi size={13} /> : <WifiOff size={13} />}
              {config.cloud_provider ? "متصل" : "غير متصل"}
            </span>
            <Typography variant="h3" color="primary" className="flex items-center gap-2">
              <RefreshCw size={18} className="text-ocean-400" /> حالة المزامنة
            </Typography>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {config.cloud_provider ? (
              <>
                <div className="flex justify-between items-center text-sm" dir="rtl">
                  <span className="text-zinc-400">حالة الربط:</span>
                  <span className="text-green-400 font-bold flex items-center gap-1.5 bg-green-400/10 px-3 py-1.5 rounded-lg border border-green-400/20">
                    <Check className="h-4 w-4" /> متصل سحابياً بـ {config.cloud_provider}
                  </span>
                </div>
                {syncReport && (
                  <div className="bg-ocean-500/10 border border-ocean-400/20 p-4 rounded-xl text-sm flex flex-col gap-1.5 text-right mt-2" dir="rtl">
                    <span className="font-bold text-ocean-300">{syncReport.status}</span>
                    <span className="text-zinc-300">{syncReport.message}</span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-1 pt-2 border-t border-ocean-400/10 inline-block">الملفات المرفوعة: {syncReport.files_synced}</span>
                  </div>
                )}
                <button
                  onClick={handleUnlinkDropbox}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs self-start mt-auto font-medium"
                >
                  <Link2Off className="h-4 w-4" /> إلغاء الربط
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-4" dir="rtl">
                <Typography variant="body" color="muted" className="text-sm leading-relaxed">
                  1. انقر على الزر أدناه لفتح المتصفح وتسجيل الدخول في Dropbox.
                </Typography>
                <Button variant="secondary" onClick={handleGetAuthCode} className="w-full flex items-center justify-center gap-2 py-3">
                  <Link className="h-4 w-4" /> احصل على كود التفويض من المتصفح
                </Button>
                <Typography variant="body" color="muted" className="text-sm leading-relaxed mt-2">
                  2. الصق كود التفويض المستلم في الحقل أدناه لتأكيد المزامنة:
                </Typography>
                <div className="flex gap-3">
                  <input
                    type="password"
                    placeholder="الصق الكود هنا..."
                    value={dropboxCode}
                    onChange={(e) => setDropboxCode(e.target.value)}
                    className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-ocean-400/50 focus:bg-white/5 transition-all text-right"
                    dir="rtl"
                  />
                  <Button variant="primary" onClick={handleExchangeCode}>تأكيد</Button>
                </div>
              </div>
            )}
          </div>

          {config.cloud_provider && (
            <Button variant="secondary" onClick={handleSyncNow} disabled={syncing} className="w-full mt-4 py-3 font-bold">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "جاري المزامنة..." : "مزامنة الآن"}
            </Button>
          )}
        </GlassPanel>

        {/* Application Updater Card */}
        <UpdaterCard />
      </div>

      {/* ── Row 2: Import + Publish ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Import Dropzone */}
        <GlassPanel
          intensity="low"
          onClick={handleImportPack}
          className="p-8 flex flex-col items-center justify-center border-dashed border-2 border-white/10 hover:border-ocean-400/50 hover:bg-ocean-500/5 transition-all duration-300 group cursor-pointer min-h-[180px]"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-ocean-500/10 group-hover:border-ocean-400/30 transition-all duration-300">
            <Download size={26} className="text-zinc-500 group-hover:text-ocean-400 transition-colors" />
          </div>
          <Typography variant="h2" color="primary" className="mb-1.5 text-center">استيراد حزمة (.sa-pack)</Typography>
          <Typography variant="body" color="muted" className="text-sm text-center">انقر هنا لتصفح واستيراد حزمة sa-pack محلية</Typography>
        </GlassPanel>

        {/* Publish Sound Pack */}
        <GlassPanel intensity="low" className="p-6 border-ocean-500/10 flex flex-col gap-5">
          <Typography variant="h2" color="primary" className="flex items-center justify-end gap-3 border-b border-white/5 pb-4 text-right">
            نشر حزمة للمجتمع <Upload className="h-5 w-5 text-ocean-400" />
          </Typography>
          <div className="flex flex-col gap-4 text-right" dir="rtl">
            <input
              type="text"
              placeholder="عنوان الحزمة..."
              value={publishTitle}
              onChange={(e) => setPublishTitle(e.target.value)}
              className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-ocean-400/50 focus:bg-white/5 transition-all"
            />
            <input
              type="text"
              placeholder="وصف محتويات الحزمة..."
              value={publishDesc}
              onChange={(e) => setPublishDesc(e.target.value)}
              className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-ocean-400/50 focus:bg-white/5 transition-all"
            />
            <div className="max-h-36 overflow-y-auto border border-white/10 rounded-xl bg-black/20 p-3 flex flex-col gap-2 custom-scrollbar">
              {config.sounds.map(s => (
                <label key={s.id} className="flex items-center gap-3 text-sm text-zinc-200 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={!!selectedSoundsForPack[s.id]}
                    onChange={(e) => setSelectedSoundsForPack({ ...selectedSoundsForPack, [s.id]: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-ocean-500 cursor-pointer"
                  />
                  <span className="font-bold flex-1 text-right">{s.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">({s.code})</span>
                </label>
              ))}
              {config.sounds.length === 0 && (
                <div className="flex flex-col items-center justify-center py-4 gap-2 opacity-50">
                  <span className="text-sm text-zinc-400 text-center">لا يوجد أصوات في المكتبة بعد.</span>
                </div>
              )}
            </div>
            <Button variant="primary" onClick={handlePublishPack} disabled={publishingPack} className="py-3 font-bold">
              {publishingPack ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> جاري النشر...</> : <><Upload className="h-4 w-4 mr-2" /> نشر الحزمة</>}
            </Button>
          </div>
        </GlassPanel>
      </div>

      {/* ── Sound Packs Section ─────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-8">
        <SoundPacksSection />
      </div>

      {/* ── Community Packs ─────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-8">
        <Typography variant="h2" color="primary" className="mb-6 flex items-center justify-end gap-3 text-right">
          الأكثر تحميلاً هذا الأسبوع <Star size={22} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
        </Typography>

        {loadingPacks ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-ocean-400" />
            <Typography variant="body" color="muted">جاري تحميل حزم المجتمع المقترحة...</Typography>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communityPacks.map((pack) => (
              <GlassPanel key={pack.id} intensity="low" className="overflow-hidden group flex flex-col justify-between h-[300px] border-white/5 hover:border-ocean-400/30 transition-all duration-300 p-0">
                <div className="h-32 bg-gradient-to-br from-ocean-950/80 to-black relative flex-shrink-0 border-b border-white/5">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
                  {pack.download_url.includes("StreamAudioCore\\packs") && (
                    <span className="absolute top-3 right-3 text-[10px] px-2.5 py-1 bg-ocean-500/20 text-ocean-300 font-bold border border-ocean-500/30 rounded-lg backdrop-blur-md">
                      حزمة محلية منشورة
                    </span>
                  )}
                  <span className="absolute bottom-3 left-3 text-[11px] px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 font-mono text-zinc-300 font-bold">
                    {pack.size}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div className="text-right">
                    <Typography variant="h3" color="primary" className="mb-1.5">{pack.title}</Typography>
                    <Typography variant="caption" color="muted" className="leading-relaxed line-clamp-2">{pack.description}</Typography>
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => handleRatePack(pack.id, star)} className="transition transform hover:scale-125 cursor-pointer">
                          <Star className={`h-4 w-4 transition-colors ${star <= Math.round(pack.rating) ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" : "text-zinc-600 fill-transparent hover:text-zinc-400"}`} />
                        </button>
                      ))}
                      <span className="text-[11px] font-mono text-zinc-400 ml-1.5 font-bold">({pack.rating.toFixed(1)})</span>
                    </div>
                    <Button variant="secondary" onClick={() => handleInstallCommunityPack(pack.download_url)} className="px-4 py-1.5 text-xs font-bold">
                      تثبيت الحزمة
                    </Button>
                  </div>
                </div>
              </GlassPanel>
            ))}
            {communityPacks.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <GlassPanel intensity="low" className="inline-flex flex-col items-center justify-center p-8 border-dashed border-white/10">
                  <Star size={40} className="text-zinc-600 mb-4 opacity-50" />
                  <Typography variant="h3" color="muted">لا توجد حزم متاحة في المجتمع حالياً.</Typography>
                  <Typography variant="caption" color="muted" className="mt-2">كن أول من ينشر حزمة صوتية!</Typography>
                </GlassPanel>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
});

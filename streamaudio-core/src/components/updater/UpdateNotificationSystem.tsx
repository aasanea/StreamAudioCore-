import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  ArrowDownToLine, X, RefreshCw, Sparkles,
  CheckCircle2, AlertCircle, Loader2, FileText
} from 'lucide-react';
import { useLanguage } from '../../i18n';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string | null;
  release_notes: string | null;
  download_size: string | null;
}

type UpdatePhase =
  | 'idle'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error';

// ─── UpdateNotificationSystem ─────────────────────────────────────────────────
//
//  Handles the full update UX lifecycle:
//    1. App.tsx calls checkForUpdates() on startup.
//    2. If an update exists → a toast banner slides in from top-right.
//    3. User clicks "تحديث الآن" → modal opens with release notes + progress.
//    4. Tauri downloads, installs, and restarts the app — zero user friction.
//
// Usage:
//   <UpdateNotificationSystem />   ← drop inside App.tsx, outside routing
// ─────────────────────────────────────────────────────────────────────────────

const UpdateNotificationSystem: React.FC = () => {
  const { t } = useLanguage();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [totalDownloaded, setTotalDownloaded] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // ── Listen to Tauri updater events ─────────────────────────────────────────
  useEffect(() => {
    const unlistenStatus = listen<{ status: string; message: string }>(
      'updater://status',
      ({ payload }) => {
        if (payload.status === 'downloading') setPhase('downloading');
        if (payload.status === 'installing') setPhase('installing');
        if (payload.status === 'restart') setPhase('done');
      }
    );

    const unlistenProgress = listen<{ downloaded: number; total: number }>(
      'updater://progress',
      ({ payload }) => {
        const { downloaded, total } = payload;
        setTotalDownloaded(downloaded);
        setTotalSize(total);
        if (total > 0) {
          setDownloadProgress(Math.min(Math.round((downloaded / total) * 100), 99));
        }
      }
    );

    return () => {
      unlistenStatus.then(fn => fn());
      unlistenProgress.then(fn => fn());
    };
  }, []);

  // ── Silent background check on startup ─────────────────────────────────────
  // Called once by App.tsx via the exported hook — NOT here directly.
  // This component only reacts to updates found externally.

  // ── Expose setter so App.tsx can inject the result ─────────────────────────
  // (handled via context — see useUpdateNotifier hook below)

  const handleUpdateFound = useCallback((info: UpdateInfo) => {
    setUpdateInfo(info);
    setPhase('available');
    setShowToast(true);
  }, []);

  // Store handler on window so App.tsx can call it after the startup check
  useEffect(() => {
    (window as any).__streamaudio_notify_update = handleUpdateFound;
    return () => { delete (window as any).__streamaudio_notify_update; };
  }, [handleUpdateFound]);

  // ── Install handler ─────────────────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    setPhase('downloading');
    setDownloadProgress(0);
    setError(null);
    try {
      await invoke('install_update');
    } catch (e: any) {
      setPhase('error');
      setError(String(e));
    }
  }, []);

  const dismissToast = () => setShowToast(false);
  const openModal = () => { setShowModal(true); setShowToast(false); };
  const closeModal = () => {
    if (phase !== 'downloading' && phase !== 'installing') {
      setShowModal(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  };

  const isProcessing = phase === 'downloading' || phase === 'installing';

  return (
    <>
      {/* ── Toast Banner ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showToast && phase === 'available' && (
          <motion.div
            key="update-toast"
            initial={{ opacity: 0, y: -80, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-4 right-4 z-[9999] max-w-sm w-full"
            style={{ direction: 'rtl' }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-black/80 backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.2)] p-4">
              {/* Glow accent */}
              <div className="absolute top-0 right-0 w-32 h-16 bg-amber-400/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />

              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <button
                  onClick={dismissToast}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5 flex-shrink-0"
                >
                  <X size={15} />
                </button>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-sm font-bold text-white">{t('upd_new_available')}</span>
                  <div className="w-7 h-7 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-amber-400" />
                  </div>
                </div>
              </div>

              {/* Version info */}
              <div className="flex justify-between items-center text-xs mb-3 gap-2">
                <span className="font-mono text-zinc-400">{updateInfo?.current_version}</span>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="font-mono">{updateInfo?.current_version}</span>
                  <span className="text-zinc-600">←</span>
                  <span className="font-mono font-bold text-amber-300">{updateInfo?.latest_version}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={dismissToast}
                  className="flex-1 py-2 text-xs text-zinc-400 hover:text-zinc-200 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                >
                  {t('upd_later')}
                </button>
                <button
                  onClick={openModal}
                  className="flex-1 py-2 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center justify-center gap-1.5"
                >
                  <ArrowDownToLine size={13} />
                  {t('upd_now')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Update Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="update-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Modal */}
            <motion.div
              key="update-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-6 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(6,182,212,0.15)] overflow-hidden"
                dir="rtl"
              >
                {/* Header */}
                <div className="relative p-6 border-b border-white/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-ocean-500/5 pointer-events-none" />
                  <div className="flex items-center justify-between">
                    {!isProcessing && phase !== 'done' && (
                      <button
                        onClick={closeModal}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all"
                      >
                        <X size={15} />
                      </button>
                    )}
                    <div className="flex items-center gap-3 flex-1 justify-end">
                      <div>
                        <h2 className="text-lg font-bold text-white">{t('upd_title')}</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {updateInfo?.current_version} → <span className="text-amber-400 font-bold">{updateInfo?.latest_version}</span>
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-400/20 flex items-center justify-center">
                        <Sparkles size={22} className="text-amber-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-5">

                  {/* Phase: available — show release notes */}
                  {phase === 'available' && (
                    <>
                      {updateInfo?.release_notes && (
                        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText size={14} className="text-ocean-400" />
                            <span className="text-xs font-bold text-zinc-300">{t('upd_release_notes')}</span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {updateInfo.release_notes}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-zinc-500 bg-white/3 rounded-xl px-3 py-2">
                        <span className="text-zinc-400">{t('upd_restart_notice')}</span>
                        <RefreshCw size={12} className="text-zinc-500" />
                      </div>
                    </>
                  )}

                  {/* Phase: downloading */}
                  {(phase === 'downloading' || phase === 'installing') && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400 text-xs">
                          {phase === 'installing' ? t('upd_installing') :
                            totalSize > 0
                              ? `${formatBytes(totalDownloaded)} / ${formatBytes(totalSize)}`
                              : t('upd_downloading')
                          }
                        </span>
                        <span className="font-bold text-white text-sm">
                          {phase === 'installing' ? '100%' : `${downloadProgress}%`}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: '0%' }}
                          animate={{
                            width: phase === 'installing' ? '100%' : `${downloadProgress}%`,
                          }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          style={{
                            background: phase === 'installing'
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #0891b2, #22d3ee)',
                            boxShadow: phase === 'installing'
                              ? '0 0 12px rgba(245,158,11,0.6)'
                              : '0 0 12px rgba(6,182,212,0.6)',
                          }}
                        />
                      </div>

                      <p className="text-xs text-center text-zinc-500">
                        {phase === 'installing'
                          ? t('upd_restart_soon')
                          : t('upd_dont_close')
                        }
                      </p>
                    </div>
                  )}

                  {/* Phase: done */}
                  {phase === 'done' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <CheckCircle2 size={48} className="text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                      <p className="text-white font-bold">{t('upd_done')}</p>
                      <p className="text-xs text-zinc-400">{t('upd_restarting')}</p>
                    </div>
                  )}

                  {/* Phase: error */}
                  {phase === 'error' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <AlertCircle size={40} className="text-red-400" />
                      <p className="text-white font-bold">{t('upd_failed')}</p>
                      <p className="text-xs text-zinc-500 text-center leading-relaxed">{error}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  {(phase === 'available' || phase === 'error') && (
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={closeModal}
                        className="flex-1 py-3 text-sm text-zinc-400 hover:text-zinc-200 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                      >
                        {phase === 'error' ? t('upd_close') : t('upd_later')}
                      </button>
                      {phase === 'available' && (
                        <button
                          onClick={handleInstall}
                          className="flex-1 py-3 text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2"
                        >
                          <ArrowDownToLine size={16} />
                          {t('upd_install_restart')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Spinner while processing */}
                  {isProcessing && (
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 pt-1">
                      <Loader2 size={13} className="animate-spin" />
                      <span>{t('upd_wait')}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default UpdateNotificationSystem;

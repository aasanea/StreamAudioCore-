import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Loader2, AlertTriangle, DownloadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DownloadProgress {
  dependency: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
}

export function DependencyGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [progresses, setProgresses] = useState<Record<string, DownloadProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkDeps();
  }, []);

  const checkDeps = async () => {
    try {
      setChecking(true);
      setError(null);
      const missing: string[] = await invoke("check_dependencies");
      if (missing.length === 0) {
        setReady(true);
      } else {
        setNeedsUpdate(missing);
        startDownload(missing);
      }
    } catch (err: any) {
      console.error("Dependency check failed:", err);
      // Even on failure (e.g. offline), if we didn't get missing files list,
      // it means the backend checked local files and they exist, or it failed entirely.
      // The backend handles offline fallback and returns what's locally missing.
      setError(err.toString());
    } finally {
      setChecking(false);
    }
  };

  const startDownload = async (deps: string[]) => {
    setDownloading(true);
    setError(null);
    
    const unlisten = await listen<DownloadProgress>("dep_download_progress", (event) => {
      setProgresses(prev => ({
        ...prev,
        [event.payload.dependency]: event.payload
      }));
    });

    try {
      for (const dep of deps) {
        await invoke("download_dependency", { name: dep });
      }
      setReady(true);
    } catch (err: any) {
      setError(`فشل التحميل: ${err.toString()}`);
    } finally {
      setDownloading(false);
      unlisten();
    }
  };

  if (ready) return <>{children}</>;

  return (
    <div className="h-screen w-screen bg-[#09090b] flex items-center justify-center font-['Cairo'] text-white overflow-hidden p-6 relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
            <DownloadCloud className="w-8 h-8 text-blue-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              تحديث ملفات النظام
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              لضمان تشغيل البرنامج بأفضل أداء، جاري إعداد التبعيات اللازمة (Media Engines). هذه العملية تحدث مرة واحدة.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {checking && (
              <motion.div 
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center space-x-2 space-x-reverse text-blue-400"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري فحص حالة الملفات...</span>
              </motion.div>
            )}

            {downloading && (
              <motion.div 
                key="downloading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full space-y-4"
              >
                {needsUpdate.map(dep => {
                  const prog = progresses[dep];
                  const pct = prog?.progress || 0;
                  const isExtracting = pct === 100 && !ready;
                  
                  return (
                    <div key={dep} className="space-y-2 text-right">
                      <div className="flex justify-between text-xs text-white/70 px-1">
                        <span>{isExtracting ? "جاري استخراج الملفات والتأكد من الأمان..." : `${Math.floor(pct)}%`}</span>
                        <span className="font-mono">{dep}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 relative"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ ease: "linear" }}
                        >
                          {isExtracting && (
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          )}
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {error && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex flex-col items-center space-y-3"
              >
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm font-medium">{error}</p>
                <button 
                  onClick={checkDeps}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors text-white mt-2"
                >
                  إعادة المحاولة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

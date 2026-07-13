import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { neonColors } from '../../constants';
import { useLanguage } from '../../i18n';

export interface PadSettingsState {
  editingPadIndex: number | null;
  padMuted: boolean;
  padSoloed: boolean;
  padLocked: boolean;
  padFilter: string;
  padImagePath: string | null;
  padColor: string;
  padCueStart: number;
  padCueEnd: number;
  padSpeed: number;
  padMode: string;
}

export interface PadSettingsActions {
  setEditingPadIndex: (idx: number | null) => void;
  setPadMuted: (val: boolean) => void;
  setPadSoloed: (val: boolean) => void;
  setPadLocked: (val: boolean) => void;
  setPadFilter: (val: string) => void;
  setPadImagePath: (val: string | null) => void;
  setPadColor: (val: string) => void;
  setPadCueStart: (val: number) => void;
  setPadCueEnd: (val: number) => void;
  setPadSpeed: (val: number) => void;
  setPadMode: (val: string) => void;
  savePadOptions: () => void;
}

export interface PadEditModalProps {
  padSettingsState: PadSettingsState;
  padSettingsActions: PadSettingsActions;
}

export const PadEditModal: React.FC<PadEditModalProps> = ({
  padSettingsState,
  padSettingsActions
}) => {
  const { t } = useLanguage();
  const {
    editingPadIndex,
    padMuted,
    padSoloed,
    padLocked,
    padFilter,
    padImagePath,
    padColor,
    padCueStart,
    padCueEnd,
    padSpeed,
    padMode
  } = padSettingsState;

  const {
    setEditingPadIndex,
    setPadMuted,
    setPadSoloed,
    setPadLocked,
    setPadFilter,
    setPadImagePath,
    setPadColor,
    setPadCueStart,
    setPadCueEnd,
    setPadSpeed,
    setPadMode,
    savePadOptions
  } = padSettingsActions;

  if (editingPadIndex === null) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-pointer"
      onClick={() => setEditingPadIndex(null)}
    >
      <div 
        className="glass-card w-full max-w-md rounded-2xl p-6 border border-border-main flex flex-col gap-5 shadow-2xl bg-surface cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-right text-base font-bold text-text-main border-b border-border-main pb-3" dir="rtl">
          {t('pad_edit_title', { pad: editingPadIndex + 1 })}
        </h3>
        
        {/* Lock, Mute, Solo row */}
        <div className="flex justify-between items-center gap-2 bg-primary/60 p-3.5 rounded-xl border border-border-main" dir="rtl">
          <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
            <input 
              type="checkbox"
              checked={padMuted}
              onChange={(e) => setPadMuted(e.target.checked)}
              className="rounded border-border-main text-neon-cyan focus:ring-neon-cyan/50"
            />
            {t('pad_mute')}
          </label>
          <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
            <input 
              type="checkbox"
              checked={padSoloed}
              onChange={(e) => setPadSoloed(e.target.checked)}
              className="rounded border-border-main text-neon-cyan focus:ring-neon-cyan/50"
            />
            {t('pad_solo')}
          </label>
          <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
            <input 
              type="checkbox"
              checked={padLocked}
              onChange={(e) => setPadLocked(e.target.checked)}
              className="rounded border-border-main text-neon-cyan focus:ring-neon-cyan/50"
            />
            {t('pad_lock')}
          </label>
        </div>

        {/* Filter DSP settings */}
        <div className="flex flex-col gap-2" dir="rtl">
          <label className="text-xs text-text-main font-semibold">{t('pad_dsp_filters')}</label>
          <select
            value={padFilter}
            onChange={(e) => setPadFilter(e.target.value)}
            className="rounded-lg bg-primary border border-border-main px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-neon-cyan/50 transition-colors cursor-pointer"
          >
            <option value="none">{t('pad_filter_none')}</option>
            <option value="lowpass">{t('pad_filter_lp')}</option>
            <option value="highpass">{t('pad_filter_hp')}</option>
            <option value="reverb">{t('pad_filter_reverb')}</option>
          </select>
        </div>

        {/* Background Image selector */}
        <div className="flex flex-col gap-2" dir="rtl">
          <label className="text-xs text-text-main font-semibold">{t('pad_bg_image')}</label>
          <div className="flex gap-2 items-center">
            <input 
              type="text"
              placeholder={t('pad_no_image')}
              value={padImagePath || ""}
              readOnly
              className="flex-1 rounded-lg bg-primary border border-border-main px-3 py-2 text-xs text-text-main focus:outline-none text-right truncate cursor-not-allowed"
            />
            <button
              onClick={async () => {
                try {
                  const selected = await invoke<string | null>("select_image_file");
                  if (selected) {
                    setPadImagePath(selected.replace(/\\/g, "/"));
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="bg-primary border border-border-main hover:border-[#6c8089]/30 text-zinc-400 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex-shrink-0"
            >
              {t('pad_browse')}
            </button>
            {padImagePath && (
              <button
                onClick={() => setPadImagePath(null)}
                className="bg-red-950/40 border border-red-900/50 text-red-400 hover:text-red-300 px-2 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex-shrink-0"
                title={t('pad_remove_image')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Color selector */}
        <div className="flex flex-col gap-2" dir="rtl">
          <label className="text-xs text-text-main font-semibold">{t('pad_color')}</label>
          <div className="flex gap-2 justify-between">
            {neonColors.map(nc => (
              <button
                key={nc.value}
                onClick={() => setPadColor(nc.value)}
                className={`w-7 h-7 rounded-full border transition duration-200 cursor-pointer ${
                  padColor === nc.value ? "scale-110 border-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" : "border-transparent"
                }`}
                style={{ backgroundColor: nc.value }}
                title={nc.name}
              />
            ))}
          </div>
        </div>

        {/* Cue points */}
        <div className="grid grid-cols-2 gap-3" dir="rtl">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-505 font-medium">{t('pad_start_point')}</label>
            <input 
              type="number"
              value={padCueStart}
              onChange={(e) => setPadCueStart(parseInt(e.target.value) || 0)}
              className="rounded-lg bg-primary border border-border-main px-3 py-2 text-xs text-text-main focus:outline-none focus:border-neon-cyan/50 transition-colors text-right"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-505 font-medium">{t('pad_end_point')}</label>
            <input 
              type="number"
              value={padCueEnd}
              onChange={(e) => setPadCueEnd(parseInt(e.target.value) || 0)}
              className="rounded-lg bg-primary border border-border-main px-3 py-2 text-xs text-text-main focus:outline-none focus:border-neon-cyan/50 transition-colors text-right"
            />
          </div>
        </div>

        {/* Speed slider */}
        <div className="flex flex-col gap-2" dir="rtl">
          <div className="flex justify-between items-center text-xs">
            <label className="text-text-main font-semibold">{t('pad_speed_pitch')}</label>
            <span className="text-[#6c8089] font-mono">{padSpeed.toFixed(2)}x</span>
          </div>
          <input 
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={padSpeed}
            onChange={(e) => setPadSpeed(parseFloat(e.target.value))}
            className="volume-slider w-full cursor-pointer"
          />
        </div>

        {/* Play mode */}
        <div className="flex flex-col gap-2" dir="rtl">
          <label className="text-xs text-text-main font-semibold">{t('pad_play_mode')}</label>
          <select
            value={padMode}
            onChange={(e) => setPadMode(e.target.value)}
            className="rounded-lg bg-primary border border-border-main px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-neon-cyan/50 transition-colors cursor-pointer"
          >
            <option value="one-shot">One-shot</option>
            <option value="hold">Hold</option>
            <option value="loop">Loop</option>
            <option value="toggle">Toggle</option>
          </select>
        </div>

        {/* Save actions */}
        <div className="flex items-center justify-end gap-3 mt-2 border-t border-border-main pt-4">
          <button
            onClick={() => setEditingPadIndex(null)}
            className="px-5 py-2.5 rounded-lg bg-primary border border-border-main text-zinc-400 hover:text-text-main hover:bg-zinc-800 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('pad_cancel')}
          </button>
          <button
            onClick={savePadOptions}
            className="px-5 py-2.5 rounded-lg bg-[#6c8089] text-black font-extrabold text-xs shadow-glow hover:bg-[#6c8089]/90 transition-colors cursor-pointer"
          >
            {t('pad_save')}
          </button>
        </div>
      </div>
    </div>
  );
};

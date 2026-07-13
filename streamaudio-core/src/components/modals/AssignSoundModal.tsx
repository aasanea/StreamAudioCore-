import React from 'react';
import { Folder } from 'lucide-react';
import { SoundEntry } from '../../types';
import { useLanguage } from '../../i18n';

export interface AssignState {
  assigningPadIndex: number | null;
  sounds: SoundEntry[];
}

export interface AssignActions {
  handleBrowseFileForPad: (index: number) => void;
  handleAssignLibrarySound: (padIndex: number, soundId: string) => void;
  setAssigningPadIndex: (index: number | null) => void;
}

export interface AssignSoundModalProps {
  assignState: AssignState;
  assignActions: AssignActions;
}

export const AssignSoundModal: React.FC<AssignSoundModalProps> = ({
  assignState,
  assignActions
}) => {
  const { t } = useLanguage();
  const { assigningPadIndex, sounds } = assignState;
  const { handleBrowseFileForPad, handleAssignLibrarySound, setAssigningPadIndex } = assignActions;

  if (assigningPadIndex === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 border border-border-main flex flex-col gap-5 shadow-2xl bg-surface">
        <h3 className="text-right text-base font-bold text-text-main border-b border-border-main pb-3" dir="rtl">
          {t('assign_title', { pad: assigningPadIndex + 1 })}
        </h3>

        {/* Direct file pick button */}
        <button
          onClick={() => handleBrowseFileForPad(assigningPadIndex)}
          className="w-full flex items-center justify-center gap-2 bg-[#6c8089]/15 border border-[#6c8089]/35 hover:bg-[#6c8089]/30 text-[#6c8089] py-3.5 rounded-xl text-sm font-bold transition cursor-pointer"
          dir="rtl"
        >
          <Folder size={18} />
          {t('assign_browse_local')}
        </button>

        <div className="text-right text-xs text-zinc-400 font-semibold mt-2" dir="rtl">
          {t('assign_or_lib')}
        </div>

        {/* Library list scrollable */}
        <div className="max-h-60 overflow-y-auto border border-border-main rounded-xl bg-primary/45 p-3 flex flex-col gap-2 custom-scrollbar">
          {sounds.map((s) => (
            <button
              key={s.id}
              onClick={() => handleAssignLibrarySound(assigningPadIndex, s.id)}
              className="w-full text-right px-4 py-3 rounded-lg bg-zinc-900/60 hover:bg-[#6c8089]/5 hover:text-[#6c8089] border border-white/5 hover:border-[#6c8089]/30 transition text-xs text-text-main flex justify-between items-center cursor-pointer"
              dir="rtl"
            >
              <span className="font-bold">{s.name}</span>
              <span className="font-mono text-[10px] text-zinc-500">{s.code}</span>
            </button>
          ))}
          {sounds.length === 0 && (
            <div className="text-center py-6 text-zinc-550 text-xs" dir="rtl">
              {t('assign_lib_empty')}
            </div>
          )}
        </div>

        {/* Cancel action */}
        <div className="flex items-center justify-end gap-3 mt-2 border-t border-border-main pt-4">
          <button
            onClick={() => setAssigningPadIndex(null)}
            className="px-5 py-2.5 rounded-lg bg-primary border border-border-main text-zinc-400 hover:text-text-main hover:bg-zinc-800 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('assign_cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

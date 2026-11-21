import React from 'react';
import { Gift, MailOpen, Sparkles, X } from 'lucide-react';
import type { TreeProgression, TreeProgressionStage } from '../utils/treeProgression';

interface TreeProgressIndicatorProps {
  progression: TreeProgression;
  isOwner: boolean;
  unlockedStage: TreeProgressionStage | null;
  onDismissUnlock: () => void;
  messageOverview?: { count: number; revealed: boolean; revealAt: string } | null;
  messagesLoading?: boolean;
  temporarilyHidden?: boolean;
}

const TreeProgressIndicator: React.FC<TreeProgressIndicatorProps> = ({ progression, isOwner, unlockedStage, onDismissUnlock, messageOverview, messagesLoading = false, temporarilyHidden = false }) => {
  const label = isOwner ? 'Sua árvore está evoluindo' : 'Esta árvore está evoluindo';
  if (temporarilyHidden) return null;
  return (
    <aside className="fixed left-3 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.75rem))] z-[64] w-[min(18rem,calc(100vw-1.5rem))] text-white sm:left-5" aria-label="Indicadores da árvore">
      {unlockedStage && <div className="relative pointer-events-auto mb-2 rounded-2xl border border-[#fff1a1]/35 bg-[#10271c]/95 p-3 shadow-2xl backdrop-blur-xl motion-reduce:animate-none" role="status" aria-live="polite">
        <button type="button" onClick={onDismissUnlock} className="absolute right-2 top-2 min-h-9 min-w-9 rounded-full p-1.5 text-white/45" aria-label="Fechar aviso"><X size={15} className="mx-auto" /></button>
        <Gift size={20} className="text-[#fff1a1]" /><p className="mt-1 pr-8 text-xs font-semibold text-[#fff1a1]">Nova surpresa: {unlockedStage.name}</p>
      </div>}
      <details className="group pointer-events-auto w-fit max-w-full rounded-full border border-white/10 bg-black/55 shadow-xl backdrop-blur-lg open:w-full open:rounded-2xl">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[11px] font-semibold text-[#fff1a1] [&::-webkit-details-marker]:hidden">
          <Sparkles size={14} /><span>{progression.ornamentCount} enfeites</span>
          {isOwner && messageOverview && <><span className="text-white/25">•</span><MailOpen size={13} /><span>{messageOverview.count} mensagens</span></>}
          <span className="text-white/45 group-open:hidden">＋</span>
        </summary>
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <p className="text-[11px] font-semibold text-[#fff1a1]">{label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/60">{progression.nextStage ? `${progression.remaining} para ${progression.nextStage.name.toLowerCase()}.` : 'Todas as surpresas foram reveladas.'}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression.progressToNext * 100)}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#1cbd62] to-[#fff1a1]" style={{ width: `${progression.progressToNext * 100}%` }} />
          </div>
          {isOwner && messageOverview && <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-white/55">{messagesLoading ? 'Consultando mensagens…' : messageOverview.revealed ? 'Mensagens disponíveis.' : 'Mensagens serão reveladas no Natal.'}</p>}
        </div>
      </details>
    </aside>
  );
};

export default TreeProgressIndicator;

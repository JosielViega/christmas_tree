import React from 'react';
import { Gift, Sparkles, X } from 'lucide-react';
import type { TreeProgression, TreeProgressionStage } from '../utils/treeProgression';

interface TreeProgressIndicatorProps {
  progression: TreeProgression;
  isOwner: boolean;
  unlockedStage: TreeProgressionStage | null;
  onDismissUnlock: () => void;
}

const TreeProgressIndicator: React.FC<TreeProgressIndicatorProps> = ({ progression, isOwner, unlockedStage, onDismissUnlock }) => {
  const label = isOwner ? 'Sua árvore está evoluindo!' : 'Esta árvore está evoluindo!';
  return (
    <aside className="fixed left-3 top-24 z-[64] w-[min(19rem,calc(100vw-1.5rem))] text-white md:left-6" aria-label="Progresso da árvore">
      {unlockedStage && (
        <div className="relative pointer-events-auto mb-2 animate-in fade-in slide-in-from-left-3 rounded-2xl border border-[#fff1a1]/35 bg-[#10271c]/95 p-4 shadow-2xl backdrop-blur-xl motion-reduce:animate-none" role="status" aria-live="polite">
          <button type="button" onClick={onDismissUnlock} className="absolute right-2 top-2 rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Ignorar animação da surpresa"><X size={15} /></button>
          <Gift size={22} className="text-[#fff1a1]" />
          <p className="mt-2 pr-7 text-sm font-semibold text-[#fff1a1]">Sua árvore ganhou uma nova surpresa!</p>
          <p className="mt-1 text-xs text-white/65">{unlockedStage.name}</p>
        </div>
      )}

      <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/45 px-3.5 py-3 shadow-xl backdrop-blur-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#fff1a1]"><Sparkles size={15} /> {label}</div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
          {progression.nextStage
            ? `${progression.ornamentCount} de ${progression.nextStage.threshold} enfeites para ${progression.nextStage.name.toLowerCase()}.`
            : `${progression.ornamentCount} enfeites: todas as surpresas foram reveladas.`}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={progression.nextStage ? 'Progresso para a próxima surpresa' : 'Todas as surpresas foram reveladas'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression.progressToNext * 100)}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#1cbd62] to-[#fff1a1]" style={{ width: `${progression.progressToNext * 100}%` }} />
        </div>
      </div>
    </aside>
  );
};

export default TreeProgressIndicator;

import React, { useState } from 'react';
import { Maximize, Music, Settings2, VolumeX, X } from 'lucide-react';

interface OverlayProps {
  isMusicPlaying: boolean;
  toggleMusic: () => void;
  userName: string;
  treeOwnerName: string | null;
  isRecording: boolean;
}

const Overlay: React.FC<OverlayProps> = ({ isMusicPlaying, toggleMusic, userName, treeOwnerName, isRecording }) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (fullscreenSupported) await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be rejected by browser policy; the social experience remains available.
    }
  };

  return (
    <div id="overlay-container" className="pointer-events-none absolute inset-0 z-50">
      <header className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <span aria-hidden="true" />
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[clamp(1.65rem,8vw,3rem)] leading-tight text-[#fff1a1]" style={{ fontFamily: "'Great Vibes', cursive", textShadow: '0 0 20px rgba(255, 241, 161, 0.5)' }}>
            Feliz Natal{userName ? `, ${userName}` : ''}!
          </h1>
          {treeOwnerName && <p className="mx-auto mt-1 w-fit max-w-full truncate rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/70 backdrop-blur-md">🎄 Árvore de {treeOwnerName}</p>}
        </div>

        {!isRecording && <div className="pointer-events-auto relative shrink-0">
          <button type="button" onClick={() => setOptionsOpen((open) => !open)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 shadow-xl backdrop-blur-xl" aria-label="Opções" aria-expanded={optionsOpen}>
            {optionsOpen ? <X size={19} /> : <Settings2 size={19} />}
          </button>
          {optionsOpen && <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#07120d]/95 p-2 text-sm text-white shadow-2xl backdrop-blur-xl">
            <button type="button" onClick={toggleMusic} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-white/10">
              {isMusicPlaying ? <Music size={18} className="text-[#fff1a1]" /> : <VolumeX size={18} className="text-[#fff1a1]" />}
              {isMusicPlaying ? 'Pausar música' : 'Tocar música'}
            </button>
            {fullscreenSupported && <button type="button" onClick={() => void toggleFullscreen()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-white/10"><Maximize size={18} className="text-[#fff1a1]" />Tela cheia</button>}
            {import.meta.env.DEV && <>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('christmas-tree:ambient-preview', { detail: 'santa' }))} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-amber-100 hover:bg-white/10">Testar trenó</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('christmas-tree:ambient-preview', { detail: 'star' }))} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-amber-100 hover:bg-white/10">Testar estrela</button>
            </>}
            <a href="/credits" className="flex min-h-11 w-full items-center rounded-xl px-3 text-white/75 hover:bg-white/10 hover:text-white">Créditos</a>
          </div>}
        </div>}
      </header>
    </div>
  );
};

export default Overlay;

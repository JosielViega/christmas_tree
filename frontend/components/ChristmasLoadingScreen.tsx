import React from 'react';
import { AlertTriangle, RotateCcw, TreePine } from 'lucide-react';
import type { StartupPhase } from '../utils/startup';
import { startupMessage } from '../utils/startup';

const ChristmasLoadingScreen: React.FC<{ phase: StartupPhase; onRetry: () => void }> = ({ phase, onRetry }) => (
  <div className={`christmas-loading ${phase === 'ready' ? 'christmas-loading--leaving' : ''}`} role={phase === 'error' ? 'alert' : 'status'} aria-live="polite">
    <div className="christmas-loading__stars" aria-hidden="true">✦　·　✧　·　✦</div>
    <div className="christmas-loading__card">
      <div className="christmas-loading__icon" aria-hidden="true">{phase === 'error' ? <AlertTriangle /> : <TreePine />}</div>
      <h1>{phase === 'error' ? 'Não foi possível carregar sua árvore.' : '🎄 Carregando sua árvore de Natal...'}</h1>
      <p>{phase === 'error' ? 'A inicialização demorou mais que o esperado ou encontrou uma falha.' : 'Estamos preparando um Natal cheio de magia para você! ✨'}</p>
      {phase === 'error' ? (
        <button type="button" onClick={onRetry}><RotateCcw size={17} /> Tentar novamente</button>
      ) : (
        <><div className="christmas-loading__track"><span /></div><small>{startupMessage(phase)}</small></>
      )}
    </div>
  </div>
);

export default ChristmasLoadingScreen;

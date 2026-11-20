import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, RefreshCw, Save, Trash2, X } from 'lucide-react';
import type { TreeMemoryData } from '../types';

interface MemoriesPanelProps {
  memories: TreeMemoryData[];
  busy: boolean;
  onAdd: (file: File, caption: string) => Promise<void>;
  onUpdate: (memory: TreeMemoryData, file: File | null, caption: string) => Promise<void>;
  onDelete: (memory: TreeMemoryData) => Promise<void>;
  onClose: () => void;
}

const MemoriesPanel: React.FC<MemoriesPanelProps> = ({ memories, busy, onAdd, onUpdate, onDelete, onClose }) => {
  const addInput = useRef<HTMLInputElement>(null);
  const [newCaption, setNewCaption] = useState('');
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [replacements, setReplacements] = useState<Record<string, File>>({});

  return <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/15 bg-[#07120d]/98 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:max-w-2xl sm:rounded-3xl" aria-modal="true" role="dialog" aria-labelledby="memories-title">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="memories-title" className="text-xl font-bold text-[#fff1a1]">✨ Memórias de 2026</h2><p className="mt-1 text-sm text-white/65">Guarde na sua árvore os momentos especiais que marcaram seu ano.</p></div>
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full hover:bg-white/10" aria-label="Fechar"><X className="mx-auto" size={20} /></button>
      </div>
      <p className="mt-4 rounded-xl border border-[#fff1a1]/15 bg-[#fff1a1]/5 px-3 py-2 text-sm"><strong>{memories.length} de 6</strong> memórias adicionadas.</p>
      <p className="mt-2 text-xs text-amber-100/75">Esta fotografia ficará visível para quem acessar sua árvore.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {memories.map((memory) => {
          const caption = captions[memory.public_id] ?? memory.caption ?? '';
          return <article key={memory.public_id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <img src={memory.image_url} alt={memory.caption || 'Memória do ano'} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
            <label className="mt-3 block text-xs text-white/60">Legenda<input value={caption} maxLength={80} onChange={(event) => setCaptions((current) => ({ ...current, [memory.public_id]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-[#fff1a1]/50" /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 text-xs"><RefreshCw size={14} /> Substituir<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setReplacements((current) => ({ ...current, [memory.public_id]: file })); }} /></label>
              <button type="button" disabled={busy} onClick={() => void onUpdate(memory, replacements[memory.public_id] ?? null, caption).then(() => setReplacements((current) => { const next = { ...current }; delete next[memory.public_id]; return next; })).catch(() => undefined)} className="flex min-h-11 items-center gap-2 rounded-full bg-[#1cbd62] px-3 text-xs font-semibold disabled:opacity-50"><Save size={14} /> Salvar</button>
              <button type="button" disabled={busy} onClick={() => void onDelete(memory).catch(() => undefined)} className="flex min-h-11 items-center gap-2 rounded-full border border-red-400/25 px-3 text-xs text-red-200 disabled:opacity-50"><Trash2 size={14} /> Remover</button>
            </div>
            {replacements[memory.public_id] && <p className="mt-2 truncate text-[11px] text-[#fff1a1]/70">Nova foto: {replacements[memory.public_id].name}</p>}
          </article>;
        })}
      </div>

      {memories.length < 6 ? <div className="mt-5 rounded-2xl border border-dashed border-white/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><ImagePlus size={18} className="text-[#fff1a1]" /> Adicionar memória</div>
        <input ref={addInput} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAdd(file, newCaption).then(() => { setNewCaption(''); if (addInput.current) addInput.current.value = ''; }).catch(() => undefined); }} />
        <input value={newCaption} maxLength={80} onChange={(event) => setNewCaption(event.target.value)} placeholder="Legenda opcional" className="mt-3 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#fff1a1]/50" />
        <button type="button" disabled={busy} onClick={() => addInput.current?.click()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1cbd62] font-semibold disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />} Escolher fotografia</button>
      </div> : <p className="mt-5 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">O limite de seis memórias foi atingido. Você ainda pode substituir ou remover fotografias.</p>}
    </section>
  </div>;
};

export default MemoriesPanel;

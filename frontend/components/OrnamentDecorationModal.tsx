import React, { useRef, useState } from 'react';
import { Check, Heart, Loader2, Sparkles, Star, X } from 'lucide-react';
import type { OrnamentType, SocialOrnamentData } from '../types';

interface OrnamentDecorationModalProps {
  treeOwnerName: string;
  remaining: number;
  onClose: () => void;
  onSubmit: (type: OrnamentType, senderName: string, message: string, idempotencyKey: string) => Promise<SocialOrnamentData>;
  onCreateOwnTree: () => void;
}

const choices: Array<{ type: OrnamentType; label: string; color: string; icon?: React.ReactNode }> = [
  { type: 'bauble_red', label: 'Bolinha vermelha', color: '#d9342b' },
  { type: 'bauble_gold', label: 'Bolinha dourada', color: '#f2c94c' },
  { type: 'bauble_blue', label: 'Bolinha azul', color: '#2878d0' },
  { type: 'heart', label: 'Coração', color: '#e94b68', icon: <Heart size={24} fill="currentColor" /> },
  { type: 'star', label: 'Estrela', color: '#fff1a1', icon: <Star size={25} fill="currentColor" /> },
];

const newIdempotencyKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const OrnamentDecorationModal: React.FC<OrnamentDecorationModalProps> = ({ treeOwnerName, remaining, onClose, onSubmit, onCreateOwnTree }) => {
  const [type, setType] = useState<OrnamentType>('bauble_red');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SocialOrnamentData | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || remaining <= 0) return;
    setLoading(true);
    setError('');
    try {
      const ornament = await onSubmit(type, senderName, message, idempotencyKey.current);
      setSuccess(ornament);
      idempotencyKey.current = newIdempotencyKey();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o enfeite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm pointer-events-auto" onPointerDown={(event) => event.stopPropagation()}>
      <section className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[#fff1a1]/20 bg-[#07120d]/95 p-5 text-white shadow-2xl md:p-7">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X size={20} /></button>

        {success ? (
          <div className="py-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f2e24e]/15 text-[#fff1a1]"><Sparkles size={32} /></div>
            <h2 className="mt-5 text-2xl font-semibold">🎁 Seu presente foi guardado!</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Você fez parte do Natal de {treeOwnerName}. ❤️</p>
            <p className="mt-5 font-semibold text-[#fff1a1]">Que tal criar sua própria árvore?</p>
            <button type="button" onClick={onCreateOwnTree} className="mt-3 w-full rounded-full bg-[#1cbd62] px-5 py-3 font-semibold text-white hover:bg-[#24cf70]">🎄 Criar minha árvore</button>
            <button type="button" onClick={onClose} className="mt-3 w-full rounded-full border border-white/15 px-5 py-3 font-semibold text-white/80 hover:bg-white/10">Continuar explorando</button>
          </div>
        ) : (
          <>
            <div className="pr-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#fff1a1]/65">Árvore de {treeOwnerName}</p>
              <h2 className="mt-2 text-2xl font-semibold">🎁 Decorar esta árvore</h2>
              <p className="mt-2 text-sm text-white/55">Escolha um enfeite e deixe seu nome. Restam {remaining} posições.</p>
            </div>

            {remaining <= 0 ? (
              <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">Esta árvore já atingiu o limite de enfeites.</p>
            ) : (
              <form className="mt-6 space-y-5" onSubmit={submit}>
                <fieldset>
                  <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Escolha o enfeite</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {choices.map((choice) => (
                      <button key={choice.type} type="button" onClick={() => setType(choice.type)} className={`min-h-24 rounded-2xl border p-3 text-center transition ${type === choice.type ? 'border-[#fff1a1]/60 bg-[#fff1a1]/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`} aria-pressed={type === choice.type}>
                        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full" style={{ color: choice.color, backgroundColor: `${choice.color}20` }}>{choice.icon ?? <span className="h-7 w-7 rounded-full shadow-lg" style={{ backgroundColor: choice.color }} />}</span>
                        <span className="mt-2 block text-[11px] leading-tight text-white/75">{choice.label}</span>
                        {type === choice.type && <Check size={14} className="mx-auto mt-1 text-[#fff1a1]" />}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Seu nome</span>
                  <input value={senderName} onChange={(event) => setSenderName(event.target.value)} minLength={2} maxLength={40} required autoComplete="name" className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 outline-none focus:border-[#fff1a1]/50" placeholder="Como você gostaria de aparecer?" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Deixe uma mensagem secreta</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={2} maxLength={500} required rows={5} className="w-full resize-none rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 outline-none focus:border-[#fff1a1]/50" placeholder="Escreva uma mensagem para o Natal…" />
                  <span className="mt-1 flex justify-between text-[11px] text-white/40"><span>Seu presente ficará guardado até o Natal! 🎁</span><span>{message.length}/500</span></span>
                </label>
                {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
                <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-5 py-3 font-semibold hover:bg-[#24cf70] disabled:opacity-55">
                  {loading && <Loader2 size={18} className="animate-spin" />} Guardar minha mensagem 🎄
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default OrnamentDecorationModal;

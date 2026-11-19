import React, { useState } from 'react';
import { Check, Copy, KeyRound, Link2, Loader2, TreePine, X } from 'lucide-react';
import { createTree, recoverTree, TreeApiError } from '../api/trees';
import type { ChristmasTreeAccess } from '../types';

interface TreeOnboardingProps {
  csrfToken: string;
  receipt: ChristmasTreeAccess | null;
  onAccess: (access: ChristmasTreeAccess) => void;
  onCloseReceipt: () => void;
}

const publicIdFromInput = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.split('/').pop() ?? '';
};

const TreeOnboarding: React.FC<TreeOnboardingProps> = ({
  csrfToken,
  receipt,
  onAccess,
  onCloseReceipt,
}) => {
  const [mode, setMode] = useState<'create' | 'recover'>('create');
  const [ownerName, setOwnerName] = useState('');
  const [publicId, setPublicId] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    try {
      const access = mode === 'create'
        ? await createTree(ownerName, csrfToken)
        : await recoverTree(publicIdFromInput(publicId), recoveryCode.trim(), csrfToken);
      onAccess(access);
    } catch (caught) {
      const message = caught instanceof TreeApiError
        ? caught.fields.owner_name?.[0] ?? caught.message
        : 'Ocorreu um erro inesperado. Recarregue a página e tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (kind: 'link' | 'code', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  };

  if (receipt) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm pointer-events-auto">
        <section className="relative w-full max-w-lg rounded-[2rem] border border-[#fff1a1]/25 bg-[#07120d]/95 p-6 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.65)] text-white">
          <button type="button" onClick={onCloseReceipt} className="absolute right-4 top-4 p-2 text-white/50 hover:text-white" aria-label="Fechar">
            <X size={20} />
          </button>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1cbd62]/15 text-[#66e399]">
            <Check size={28} />
          </div>
          <h2 className="font-semibold text-2xl md:text-3xl">Sua árvore está pronta!</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/65">Guarde o código abaixo agora. Ele é exibido uma única vez e será necessário para recuperar a administração em outro navegador.</p>

          <div className="mt-6 space-y-4">
            <CopyField label="Link público" value={receipt.public_url} icon={<Link2 size={16} />} copied={copied === 'link'} onCopy={() => copy('link', receipt.public_url)} />
            <CopyField label="Código de recuperação" value={receipt.recovery_code} icon={<KeyRound size={16} />} copied={copied === 'code'} onCopy={() => copy('code', receipt.recovery_code)} mono />
          </div>

          <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100/80">Sem conta, e-mail ou este código, não é possível garantir a recuperação da árvore em outro dispositivo.</p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button type="button" onClick={onCloseReceipt} className="mt-6 w-full rounded-full bg-[#f2e24e] px-5 py-3 font-semibold text-black transition hover:bg-[#fff1a1]">Ver minha árvore</button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] pointer-events-auto">
      <section className="w-full max-w-md rounded-[2rem] border border-white/15 bg-black/75 p-6 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl text-white">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#fff1a1]/25 bg-[#fff1a1]/10 text-[#fff1a1]">
          {mode === 'create' ? <TreePine size={32} /> : <KeyRound size={30} />}
        </div>
        <h1 className="text-center text-2xl md:text-3xl font-semibold">{mode === 'create' ? 'Crie sua Árvore de Natal 🎄' : 'Recupere sua árvore'}</h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-white/60">
          {mode === 'create' ? 'Dê identidade à sua árvore 3D e receba um link só seu.' : 'Informe o link ou identificador e o código salvo anteriormente.'}
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === 'create' ? (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#fff1a1]/75">Como você gostaria de ser chamado?</span>
              <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} maxLength={60} autoComplete="name" autoFocus className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-[#fff1a1]/50" placeholder="Seu nome" />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#fff1a1]/75">Link ou identificador público</span>
                <input value={publicId} onChange={(event) => setPublicId(event.target.value)} maxLength={240} autoCapitalize="none" autoCorrect="off" className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-white outline-none placeholder:text-white/25 focus:border-[#fff1a1]/50" placeholder="https://.../t/AbCdEf1234_-" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#fff1a1]/75">Código de recuperação</span>
                <input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} maxLength={128} autoCapitalize="none" autoCorrect="off" className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 font-mono text-sm text-white outline-none placeholder:text-white/25 focus:border-[#fff1a1]/50" placeholder="Cole seu código" />
              </label>
            </>
          )}

          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

          <button disabled={loading || !csrfToken} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-5 py-3.5 font-semibold text-white shadow-lg transition hover:bg-[#24cf70] disabled:cursor-not-allowed disabled:opacity-55">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {mode === 'create' ? 'Criar minha árvore' : 'Recuperar acesso'}
          </button>
        </form>

        <button type="button" onClick={() => { setMode(mode === 'create' ? 'recover' : 'create'); setError(''); }} className="mt-5 w-full text-center text-sm text-white/55 transition hover:text-white">
          {mode === 'create' ? 'Já criou uma árvore? Recuperar acesso' : 'Voltar e criar uma nova árvore'}
        </button>
      </section>
    </div>
  );
};

interface CopyFieldProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}

const CopyField: React.FC<CopyFieldProps> = ({ label, value, icon, copied, onCopy, mono = false }) => (
  <div>
    <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{icon}{label}</span>
    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.07] p-2 pl-4">
      <span className={`min-w-0 flex-1 break-all text-sm text-white/85 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
      <button type="button" onClick={onCopy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#fff1a1] hover:bg-white/15" aria-label={`Copiar ${label}`}>
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </div>
  </div>
);

export default TreeOnboarding;

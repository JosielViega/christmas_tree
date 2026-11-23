import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CheckCircle2, Copy, ExternalLink, Gift, ImagePlus, Loader2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import * as THREE from 'three';
import { GiftBoxModel } from './Presents';
import {
  GIFT_COMPOSITION_MODES,
  GIFT_STYLES,
  createCanvasTexture,
  createPersonalizedGiftCanvases,
  decodeGiftPhoto,
  disposeGiftTextures,
  replaceDecodedGiftPhoto,
  giftCanvasToPng,
  selectPersistedGiftCanvas,
} from '../utils/giftTextures';
import type { DecodedGiftPhoto, GiftCompositionMode, GiftStyleId } from '../utils/giftTextures';
import { cancelGiftDraft, createGiftIdempotencyKey, prepareGiftDraft } from '../api/giftDrafts';
import type { GiftDraftAccess } from '../api/giftDrafts';
import { createGiftPaymentOrder, fetchGiftCatalog, fetchGiftPaymentOrder } from '../api/giftPayments';
import type { GiftPaymentOrder, GiftProduct } from '../api/giftPayments';

const paymentStatusLabel: Record<GiftPaymentOrder['status'], string> = {
  pending: 'Pagamento aguardando Pix',
  paid: 'Pagamento aprovado',
  expired: 'Pagamento expirado',
  cancelled: 'Pagamento cancelado',
  refunded: 'Pagamento reembolsado',
  failed: 'Pagamento recusado',
};

interface GiftPreviewModalProps {
  maxPhotoBytes: number;
  treePublicId: string;
  csrfToken: string;
  onClose: () => void;
}

const PersonalizedGift: React.FC<{
  photo: DecodedGiftPhoto;
  style: GiftStyleId;
  mode: GiftCompositionMode;
}> = ({ photo, style, mode }) => {
  const selectedStyle = GIFT_STYLES.find((candidate) => candidate.id === style) ?? GIFT_STYLES[0];
  const textures = useMemo(() => {
    const canvases = createPersonalizedGiftCanvases(photo, style, mode);
    return {
      paper: createCanvasTexture(canvases.paper),
      front: canvases.front ? createCanvasTexture(canvases.front) : null,
    };
  }, [photo, style, mode]);

  useEffect(() => () => disposeGiftTextures(textures.front ? [textures.paper, textures.front] : [textures.paper]), [textures]);

  return (
    <group rotation={[0.08, -0.45, 0]} scale={2.1} position={[0, -0.95, 0]}>
      <GiftBoxModel texture={textures.paper} frontTexture={textures.front} ribbonColor={selectedStyle.ribbon} />
    </group>
  );
};

const GiftPreviewModal: React.FC<GiftPreviewModalProps> = ({ maxPhotoBytes, treePublicId, csrfToken, onClose }) => {
  const [photo, setPhoto] = useState<DecodedGiftPhoto | null>(null);
  const [style, setStyle] = useState<GiftStyleId>('classic');
  const [mode, setMode] = useState<GiftCompositionMode>('repeated');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [draft, setDraft] = useState<GiftDraftAccess | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [paymentAvailable, setPaymentAvailable] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [productCode, setProductCode] = useState('personalized');
  const [payerEmail, setPayerEmail] = useState('');
  const [order, setOrder] = useState<GiftPaymentOrder | null>(null);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const paymentIdempotencyKey = useRef(createGiftIdempotencyKey());
  const photoRef = useRef<DecodedGiftPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const idempotencyKey = useRef(createGiftIdempotencyKey());

  useEffect(() => {
    idempotencyKey.current = createGiftIdempotencyKey();
  }, [photo, style, mode, senderName, message]);

  useEffect(() => {
    let active = true;
    void fetchGiftCatalog().then((result) => {
      if (!active) return;
      setPaymentAvailable(result.available);
      setProducts(result.products);
      if (!result.products.some((product) => product.code === productCode) && result.products[0]) setProductCode(result.products[0].code);
      setCatalogLoaded(true);
    }).catch(() => { if (active) { setPaymentAvailable(false); setCatalogLoaded(true); } });
    return () => { active = false; };
  }, [productCode]);

  useEffect(() => {
    if (!draft || !accessToken || (order?.status !== 'pending' && !(order?.status === 'paid' && order.publication_status !== 'published'))) return;
    let active = true;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (++attempts > 60) {
        window.clearInterval(timer);
        return;
      }
      void fetchGiftPaymentOrder(draft.gift.public_id, accessToken).then((result) => {
        if (active) setOrder(result.order);
      }).catch(() => undefined);
    }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [draft, accessToken, order?.status, order?.publication_status]);

  const releasePhoto = () => {
    requestId.current += 1;
    photoRef.current = replaceDecodedGiftPhoto(photoRef.current, null);
    setPhoto(null);
  };

  useEffect(() => () => {
    requestId.current += 1;
    photoRef.current = replaceDecodedGiftPhoto(photoRef.current, null);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const selectPhoto = async (file: File | undefined) => {
    if (!file) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const decoded = await decodeGiftPhoto(file, maxPhotoBytes);
      if (currentRequest !== requestId.current) {
        decoded.dispose();
        return;
      }
      photoRef.current = replaceDecodedGiftPhoto(photoRef.current, decoded);
      setPhoto(decoded);
    } catch (caught) {
      if (currentRequest === requestId.current) setError(caught instanceof Error ? caught.message : 'Não foi possível preparar a fotografia.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const prepare = async () => {
    if (!photo || !consent || preparing) return;
    setPreparing(true);
    setError(null);
    try {
      const canvases = createPersonalizedGiftCanvases(photo, style, mode);
      const texture = await giftCanvasToPng(selectPersistedGiftCanvas(canvases, mode));
      const prepared = await prepareGiftDraft(
        treePublicId,
        { senderName, style, mode, message, texture },
        csrfToken,
        idempotencyKey.current,
      );
      const token = prepared.access_token ?? accessToken;
      if (!token) throw new Error('Não foi possível preservar o acesso privado ao rascunho.');
      setAccessToken(token);
      setDraft(prepared);
      sessionStorage.setItem(`gift-draft:${prepared.gift.public_id}`, token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar o presente.');
    } finally {
      setPreparing(false);
    }
  };

  const cancelDraft = async () => {
    if (!draft || !accessToken || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const result = await cancelGiftDraft(draft.gift.public_id, accessToken, csrfToken);
      setDraft({ ...draft, gift: result.gift });
      sessionStorage.removeItem(`gift-draft:${draft.gift.public_id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cancelar o rascunho.');
    } finally {
      setCancelling(false);
    }
  };

  const startPayment = async () => {
    if (!draft || !accessToken || !paymentAvailable || paying) return;
    setPaying(true);
    setError(null);
    try {
      const result = await createGiftPaymentOrder(
        draft.gift.public_id, accessToken, csrfToken, productCode, payerEmail, paymentIdempotencyKey.current,
      );
      setOrder(result.order);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível iniciar o pagamento Pix.');
    } finally {
      setPaying(false);
    }
  };

  const copyPix = async () => {
    if (!order?.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(order.pix_qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código Pix manualmente.');
    }
  };

  const formatPrice = (amountCents: number, currency: string) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountCents / 100);

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="gift-preview-title" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <div className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[#fff1a1]/20 bg-[#07120d] pb-[env(safe-area-inset-bottom)] text-white shadow-2xl md:max-h-[92vh] md:rounded-3xl md:pb-0">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 rounded-full bg-black/35 p-2 text-white/65 hover:bg-white/10 hover:text-white" aria-label="Fechar prévia"><X size={20} /></button>

        <div className="grid min-h-0 flex-1 md:grid-cols-[0.92fr_1.08fr]">
          <section className="order-2 min-h-0 overflow-y-auto p-5 md:order-1 md:p-7">
            <div className="flex items-center gap-2 text-[#fff1a1]"><Gift size={22} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Preparação experimental</span></div>
            <h2 id="gift-preview-title" className="mt-3 text-2xl font-bold">Prévia de presente personalizado</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">Transforme uma fotografia em uma embalagem de presente natalina!</p>
            {catalogLoaded && !paymentAvailable && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-relaxed text-amber-100">Você pode conhecer e personalizar o recurso, mas os pagamentos estão indisponíveis neste ambiente. Nenhuma cobrança ou publicação será criada.</p>}
            <div className="mt-4 flex gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-3 text-xs leading-relaxed text-emerald-100/75">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <p>A fotografia original permanece neste navegador. Somente a textura final 512×512 será enviada para armazenamento privado.</p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">1. Escolha sua fotografia</p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1cbd62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24cf70] disabled:opacity-60">
                  {loading ? <Loader2 size={17} className="animate-spin" /> : photo ? <RefreshCw size={17} /> : <ImagePlus size={17} />}
                  {loading ? 'Preparando…' : photo ? 'Trocar fotografia' : 'Selecionar foto'}
                </button>
                {photo && <button type="button" onClick={releasePhoto} className="min-h-11 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/65 hover:bg-white/5">Remover</button>}
              </div>
              <p className="mt-2 text-[11px] text-white/35">JPEG, PNG ou WebP; até {Math.round(maxPhotoBytes / 1024 / 1024)} MB. Processamento 512×512 somente neste navegador.</p>
              {error && <p className="mt-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-100" role="alert">{error}</p>}
            </div>

            <fieldset className="mt-6" disabled={!photo || loading}>
              <legend className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">2. Escolha a embalagem</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
                {GIFT_STYLES.map((option) => (
                  <button key={option.id} type="button" onClick={() => setStyle(option.id)} aria-pressed={style === option.id} className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${style === option.id ? 'border-[#fff1a1]/55 bg-[#fff1a1]/10 text-[#fff1a1]' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'}`}>
                    <span className="mb-2 block h-3 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${option.background}, ${option.ribbon})` }} />{option.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6 space-y-3" disabled={!photo || loading || draft?.gift.status === 'draft'}>
              <legend className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">4. Prepare o rascunho privado</legend>
              <label className="block text-xs text-white/65">Seu nome
                <input value={senderName} onChange={(event) => setSenderName(event.target.value)} maxLength={40} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-[#fff1a1]/55" />
              </label>
              <label className="block text-xs text-white/65">Mensagem secreta
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 p-3 text-sm text-white outline-none focus:border-[#fff1a1]/55" />
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/60">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
                <span>Estou ciente de que esta fotografia poderá ficar visível publicamente somente após uma futura publicação paga.</span>
              </label>
              {!draft && <button type="button" onClick={() => void prepare()} disabled={!photo || !consent || senderName.trim().length < 2 || message.trim().length < 2 || preparing} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24cf70] disabled:cursor-not-allowed disabled:opacity-50">
                {preparing && <Loader2 size={17} className="animate-spin" />}{preparing ? 'Preparando…' : 'Preparar presente'}
              </button>}
            </fieldset>

            {draft && <div className="mt-5 rounded-2xl border border-[#fff1a1]/25 bg-[#fff1a1]/[0.07] p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-[#fff1a1]"><CheckCircle2 size={19} />🎁 Seu presente foi preparado!</div>
              <p className="mt-2 text-xs leading-relaxed text-white/65">Este presente ainda não foi publicado. Após a confirmação segura do Pix, ele será preparado para aparecer embaixo da árvore.</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-white/40">Estado: {draft.gift.status}</p>
              {draft.gift.status === 'draft' && !order && <button type="button" onClick={() => void cancelDraft()} disabled={cancelling} className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/20 px-3 py-2 text-xs text-red-100 hover:bg-red-400/10 disabled:opacity-50"><Trash2 size={14} />{cancelling ? 'Cancelando…' : 'Cancelar rascunho'}</button>}
            </div>}

            {draft?.gift.status === 'draft' && !order && <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">5. Pagamento Pix</p>
              {!paymentAvailable ? (
                <p className="mt-3 text-xs leading-relaxed text-white/55">O pagamento Pix está indisponível neste ambiente. Nenhuma cobrança foi criada.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {products.map((product) => <button key={product.code} type="button" onClick={() => { setProductCode(product.code); paymentIdempotencyKey.current = createGiftIdempotencyKey(); }} aria-pressed={productCode === product.code} className={`rounded-xl border p-3 text-left ${productCode === product.code ? 'border-emerald-300/50 bg-emerald-300/10' : 'border-white/10 bg-black/15'}`}>
                      <span className="block text-xs font-semibold text-white/80">{product.name}</span>
                      <span className="mt-1 block text-sm font-bold text-emerald-200">{formatPrice(product.amount_cents, product.currency)}</span>
                    </button>)}
                  </div>
                  <label className="block text-xs text-white/65">E-mail exigido pelo Mercado Pago
                    <input type="email" autoComplete="email" value={payerEmail} onChange={(event) => { setPayerEmail(event.target.value); paymentIdempotencyKey.current = createGiftIdempotencyKey(); }} maxLength={160} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/50" placeholder="voce@exemplo.com" />
                  </label>
                  <p className="text-[11px] leading-relaxed text-white/40">O e-mail é enviado diretamente ao provedor para gerar o Pix e não é armazenado no banco local.</p>
                  <button type="button" onClick={() => void startPayment()} disabled={!payerEmail.includes('@') || paying} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50">
                    {paying && <Loader2 size={17} className="animate-spin" />}{paying ? 'Gerando Pix…' : 'Gerar pagamento Pix'}
                  </button>
                </div>
              )}
            </section>}

            {order && <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4 text-center" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">{paymentStatusLabel[order.status]}</p>
              <p className="mt-2 text-lg font-bold">{order.product_name} · {formatPrice(order.amount_cents, order.currency)}</p>
              {order.status === 'pending' && <>
                {order.pix_qr_code_base64 && <img src={`data:image/png;base64,${order.pix_qr_code_base64}`} alt="QR Code Pix" className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2" />}
                {order.pix_qr_code && <div className="mt-4">
                  <textarea readOnly value={order.pix_qr_code} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-[10px] text-white/55" aria-label="Pix Copia e Cola" />
                  <button type="button" onClick={() => void copyPix()} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-emerald-300/30 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/10"><Copy size={16} />{copied ? 'Código copiado' : 'Copiar código Pix'}</button>
                </div>}
                {order.pix_ticket_url && <a href={order.pix_ticket_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200 underline"><ExternalLink size={14} />Abrir instruções no Mercado Pago</a>}
                <p className="mt-3 text-[11px] text-white/40">A confirmação ocorre de forma segura pelo provedor; somente o backend pode publicar o presente.</p>
              </>}
              {order.status === 'paid' && order.publication_status === 'published' && <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mx-auto mb-2" />🎁 Seu presente foi enviado! O presente especial está esperando embaixo da árvore.</div>}
              {order.status === 'paid' && order.publication_status !== 'published' && <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mx-auto mb-2" />Pagamento confirmado. Estamos preparando seu presente.</div>}
              {['expired', 'cancelled', 'failed'].includes(order.status) && <p className="mt-3 text-xs text-amber-100">Este pagamento não está ativo. Nenhuma publicação foi realizada.</p>}
              {order.status === 'refunded' && <p className="mt-3 text-xs text-amber-100">O pagamento foi reembolsado e o presente não está mais visível na árvore.</p>}
            </section>}

            <fieldset className="mt-6" disabled={!photo || loading}>
              <legend className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">3. Personalize a estampa</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {GIFT_COMPOSITION_MODES.map((option) => (
                  <button key={option.id} type="button" onClick={() => setMode(option.id)} aria-pressed={mode === option.id} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${mode === option.id ? 'border-[#fff1a1]/55 bg-[#fff1a1]/10 text-[#fff1a1]' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'}`}>{option.name}</button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="order-1 relative min-h-[19rem] border-b border-white/10 bg-gradient-to-b from-[#0d2018] to-[#020705] md:order-2 md:min-h-[36rem] md:border-b-0 md:border-l">
            {photo ? (
              <>
                <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.1, 4.4], fov: 42 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[4, 6, 5]} intensity={2.2} color="#fff1c7" />
                  <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#8eb7ff" />
                  <PersonalizedGift photo={photo} style={style} mode={mode} />
                  <OrbitControls makeDefault enablePan={false} minDistance={3.2} maxDistance={6} target={[0, 0.15, 0]} />
                </Canvas>
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/55 backdrop-blur">Arraste para girar · use dois dedos ou a roda para aproximar</div>
                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[#fff1a1]/20 bg-black/35 px-3 py-1.5 text-xs font-semibold text-[#fff1a1]">🎁 Sua embalagem personalizada está pronta!</div>
              </>
            ) : (
              <div className="flex h-full min-h-[19rem] flex-col items-center justify-center px-8 text-center text-white/35">
                <Gift size={54} strokeWidth={1.2} />
                <p className="mt-4 text-sm font-semibold text-white/55">Selecione uma fotografia para visualizar seu presente em 3D.</p>
                <p className="mt-2 max-w-sm text-xs leading-relaxed">A prévia é temporária e não cria pedidos, compras ou presentes na árvore pública.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default GiftPreviewModal;

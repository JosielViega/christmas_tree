import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, ExternalLink, Gift, ImagePlus, Loader2, Maximize2, Minimize2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
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
import type { DecodedGiftPhoto, GiftCompositionMode, GiftPhotoCrop, GiftStyleId } from '../utils/giftTextures';
import { cancelGiftDraft, createGiftIdempotencyKey, prepareGiftDraft } from '../api/giftDrafts';
import type { GiftDraftAccess } from '../api/giftDrafts';
import { createGiftPaymentOrder, fetchGiftCatalog, fetchGiftPaymentOrder } from '../api/giftPayments';
import type { GiftPaymentOrder, GiftProduct } from '../api/giftPayments';
import { GIFT_WIZARD_STEPS, canAdvanceGiftWizard, getGiftPreviewMode, nextGiftWizardStep, previousGiftWizardStep } from '../utils/giftWizard';
import type { GiftWizardStep } from '../utils/giftWizard';

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

const PersonalizedGift: React.FC<{ texture: THREE.Texture; ribbonColor: string }> = ({ texture, ribbonColor }) => (
  <group rotation={[0.08, -0.45, 0]} scale={1.65} position={[0, -0.72, 0]}><GiftBoxModel texture={texture} ribbonColor={ribbonColor} /></group>
);

const GiftPreviewModal: React.FC<GiftPreviewModalProps> = ({ maxPhotoBytes, treePublicId, csrfToken, onClose }) => {
  const [step, setStep] = useState<GiftWizardStep>(1);
  const [photo, setPhoto] = useState<DecodedGiftPhoto | null>(null);
  const [style, setStyle] = useState<GiftStyleId>('classic');
  const [mode, setMode] = useState<GiftCompositionMode>('repeated');
  const [cropX, setCropX] = useState(0.5);
  const [cropY, setCropY] = useState(0.5);
  const [cropZoom, setCropZoom] = useState(1);
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
  const [technicalEnvironment, setTechnicalEnvironment] = useState(false);
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [productCode, setProductCode] = useState('personalized');
  const [payerEmail, setPayerEmail] = useState('');
  const [order, setOrder] = useState<GiftPaymentOrder | null>(null);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const paymentIdempotencyKey = useRef(createGiftIdempotencyKey());
  const photoRef = useRef<DecodedGiftPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const idempotencyKey = useRef(createGiftIdempotencyKey());
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => { idempotencyKey.current = createGiftIdempotencyKey(); }, [photo, style, mode, cropX, cropY, cropZoom, senderName, message]);

  useEffect(() => {
    let active = true;
    void fetchGiftCatalog().then((result) => {
      if (!active) return;
      setPaymentAvailable(result.available);
      setTechnicalEnvironment(result.technical_environment);
      setProducts(result.products);
      if (!result.products.some((product) => product.code === productCode) && result.products[0]) setProductCode(result.products[0].code);
      setCatalogLoaded(true);
    }).catch(() => { if (active) { setPaymentAvailable(false); setCatalogLoaded(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    setPreviewExpanded(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [step]);

  useEffect(() => {
    if (!draft || !accessToken || (order?.status !== 'pending' && !(order?.status === 'paid' && order.publication_status !== 'published'))) return;
    let active = true;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (++attempts > 60) { window.clearInterval(timer); return; }
      void fetchGiftPaymentOrder(draft.gift.public_id, accessToken).then((result) => { if (active) setOrder(result.order); }).catch(() => undefined);
    }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [draft, accessToken, order?.status, order?.publication_status]);

  useEffect(() => {
    if (order?.status === 'paid' && order.publication_status === 'published') setStep(6);
  }, [order?.status, order?.publication_status]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => () => {
    requestId.current += 1;
    photoRef.current = replaceDecodedGiftPhoto(photoRef.current, null);
  }, []);

  const releasePhoto = () => {
    requestId.current += 1;
    photoRef.current = replaceDecodedGiftPhoto(photoRef.current, null);
    setPhoto(null);
  };

  const selectPhoto = async (file: File | undefined) => {
    if (!file) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const decoded = await decodeGiftPhoto(file, maxPhotoBytes);
      if (currentRequest !== requestId.current) { decoded.dispose(); return; }
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
      const canvases = createPersonalizedGiftCanvases(photo, style, mode, undefined, { x: cropX, y: cropY, zoom: cropZoom });
      const texture = await giftCanvasToPng(selectPersistedGiftCanvas(canvases, mode));
      const prepared = await prepareGiftDraft(treePublicId, { senderName, style, mode, message, texture }, csrfToken, idempotencyKey.current);
      const token = prepared.access_token ?? accessToken;
      if (!token) throw new Error('Não foi possível preservar o acesso privado ao rascunho.');
      setAccessToken(token);
      setDraft(prepared);
      sessionStorage.setItem(`gift-draft:${prepared.gift.public_id}`, token);
      setStep(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar o presente.');
    } finally { setPreparing(false); }
  };

  const cancelDraft = async () => {
    if (!draft || !accessToken || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelGiftDraft(draft.gift.public_id, accessToken, csrfToken);
      sessionStorage.removeItem(`gift-draft:${draft.gift.public_id}`);
      setDraft(null);
      setAccessToken(null);
      setOrder(null);
      idempotencyKey.current = createGiftIdempotencyKey();
      paymentIdempotencyKey.current = createGiftIdempotencyKey();
      setStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cancelar o rascunho.');
    } finally { setCancelling(false); }
  };

  const startPayment = async () => {
    if (!draft || !accessToken || !paymentAvailable || paying) return;
    setPaying(true);
    setError(null);
    try {
      const result = await createGiftPaymentOrder(draft.gift.public_id, accessToken, csrfToken, productCode, payerEmail, paymentIdempotencyKey.current);
      setOrder(result.order);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível iniciar o pagamento Pix.');
    } finally { setPaying(false); }
  };

  const copyPix = async () => {
    if (!order?.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(order.pix_qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setError('Não foi possível copiar automaticamente. Selecione o código Pix manualmente.'); }
  };

  const formatPrice = (amountCents: number, currency: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountCents / 100);
  const selectedProduct = products.find((product) => product.code === productCode) ?? products[0] ?? null;
  const crop = useMemo<GiftPhotoCrop>(() => ({ x: cropX, y: cropY, zoom: cropZoom }), [cropX, cropY, cropZoom]);
  const previewTexture = useMemo(
    () => photo ? createCanvasTexture(createPersonalizedGiftCanvases(photo, style, mode, undefined, crop).paper) : null,
    [photo, style, mode, crop],
  );
  useEffect(() => () => disposeGiftTextures(previewTexture ? [previewTexture] : []), [previewTexture]);
  const previewMode = getGiftPreviewMode(step, isMobile, previewExpanded);
  const selectedStyle = GIFT_STYLES.find((candidate) => candidate.id === style) ?? GIFT_STYLES[0];
  const wizardInput = { productSelected: selectedProduct !== null, photoSelected: photo !== null, senderName, message, consent };
  const selectProduct = (product: GiftProduct) => {
    setProductCode(product.code);
    paymentIdempotencyKey.current = createGiftIdempotencyKey();
  };
  const goBack = () => { setError(null); setStep(previousGiftWizardStep(step)); };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="gift-preview-title" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <div className="relative flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[#fff1a1]/20 bg-[#07120d] pb-[env(safe-area-inset-bottom)] text-white shadow-2xl md:h-auto md:max-h-[92vh] md:rounded-3xl md:pb-0">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 rounded-full bg-black/35 p-2 text-white/65 hover:bg-white/10 hover:text-white" aria-label="Fechar personalização"><X size={20} /></button>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[0.92fr_1.08fr] md:grid-rows-1">
          <section ref={contentRef} className="order-2 min-h-0 scroll-pb-28 overflow-y-auto overscroll-contain p-5 md:order-1 md:p-7">
            <header className="pr-10">
              <div className="flex items-center gap-2 text-[#fff1a1]"><Gift size={22} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Presente premium</span></div>
              <h2 id="gift-preview-title" className="mt-2 text-2xl font-bold">Crie um presente especial</h2>
              {technicalEnvironment && <span className="mt-2 inline-flex rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100">Ambiente técnico · Sandbox</span>}
              <p className="mt-1 text-sm text-white/60">Uma escolha por vez, com pagamento seguro somente no final.</p>
            </header>
            <p className="mt-4 text-xs font-semibold text-[#fff1a1] sm:hidden" aria-live="polite">Etapa {step} de 6 · {GIFT_WIZARD_STEPS[step - 1].label}</p>
            <ol className="mt-2 grid grid-cols-6 gap-1 sm:mt-5" aria-label={`Etapa ${step} de 6`}>
              {GIFT_WIZARD_STEPS.map((item) => <li key={item.id} className="min-w-0 text-center" aria-current={item.id === step ? 'step' : undefined}><span className={`mx-auto block h-1.5 rounded-full transition-colors ${item.id <= step ? 'bg-[#e4c45e]' : 'bg-white/10'}`} /><span className={`mt-1 hidden truncate text-[9px] sm:block ${item.id === step ? 'text-[#fff1a1]' : 'text-white/30'}`}>{item.label}</span></li>)}
            </ol>
            {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-100" role="alert">{error}</p>}

            <div key={step} className="gift-step-panel mt-6" data-step={step} data-reduced-motion={reducedMotion || undefined}>
              {step === 1 && <section aria-labelledby="gift-step-choice">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#fff1a1]">Etapa 1 de 6</p><h3 id="gift-step-choice" className="mt-2 text-xl font-semibold">Escolha seu presente</h3><p className="mt-1 text-sm text-white/55">Selecione a experiência e confira o valor definido pelo servidor.</p>
                {!catalogLoaded ? <div className="mt-5 flex items-center gap-2 text-sm text-white/55"><Loader2 size={18} className="animate-spin" /> Consultando opções…</div> : <div className="mt-5 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">{products.map((product) => <button key={product.code} type="button" onClick={() => selectProduct(product)} aria-pressed={productCode === product.code} className={`min-h-24 rounded-2xl border p-4 text-left transition ${productCode === product.code ? 'border-[#fff1a1]/60 bg-[#fff1a1]/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><Gift size={20} className={productCode === product.code ? 'text-[#fff1a1]' : 'text-white/45'} /><span className="mt-3 block text-sm font-semibold">{product.name}</span><span className="mt-1 block text-base font-bold text-emerald-200">{formatPrice(product.amount_cents, product.currency)}</span></button>)}</div>}
                {catalogLoaded && !paymentAvailable && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-relaxed text-amber-100">Você pode conhecer a personalização, mas os pagamentos estão indisponíveis neste ambiente. Nenhuma cobrança ou publicação será criada.</p>}
              </section>}

              {step === 2 && <section aria-labelledby="gift-step-personalize">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#fff1a1]">Etapa 2 de 6</p><h3 id="gift-step-personalize" className="mt-2 text-xl font-semibold">Personalize a embalagem</h3>
                <div className="mt-4 flex gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-3 text-xs leading-relaxed text-emerald-100/75"><ShieldCheck size={18} className="shrink-0 text-emerald-300" /><p>A foto original fica neste navegador. Somente a textura final 512×512 é enviada ao armazenamento privado.</p></div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1cbd62] px-4 py-2.5 text-sm font-semibold hover:bg-[#24cf70] disabled:opacity-60">{loading ? <Loader2 size={17} className="animate-spin" /> : photo ? <RefreshCw size={17} /> : <ImagePlus size={17} />}{loading ? 'Preparando…' : photo ? 'Trocar fotografia' : 'Selecionar foto'}</button>{photo && <button type="button" onClick={releasePhoto} className="min-h-11 rounded-full border border-white/15 px-4 text-sm text-white/65 hover:bg-white/5">Remover</button>}</div>
                <p className="mt-2 text-[11px] text-white/35">JPEG, PNG ou WebP; até {Math.round(maxPhotoBytes / 1024 / 1024)} MB.</p>
                {photo && <fieldset className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><legend className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-white/45">Enquadramento da foto</legend><label className="mt-2 block text-[11px] text-white/55">Zoom · {cropZoom.toFixed(1)}×<input type="range" min="1" max="3" step="0.1" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="mt-1 w-full accent-[#e4c45e]" /></label><label className="mt-2 block text-[11px] text-white/55">Horizontal<input type="range" min="0" max="1" step="0.05" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} className="mt-1 w-full accent-[#e4c45e]" /></label><label className="mt-2 block text-[11px] text-white/55">Vertical<input type="range" min="0" max="1" step="0.05" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} className="mt-1 w-full accent-[#e4c45e]" /></label></fieldset>}
                <fieldset className="mt-5" disabled={!photo || loading}><legend className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">Tema</legend><div className="mt-2 grid grid-cols-3 gap-2">{GIFT_STYLES.map((option) => <button key={option.id} type="button" onClick={() => setStyle(option.id)} aria-pressed={style === option.id} className={`min-h-16 rounded-xl border p-2 text-left text-[11px] font-semibold ${style === option.id ? 'border-[#fff1a1]/55 bg-[#fff1a1]/10 text-[#fff1a1]' : 'border-white/10 text-white/55'}`}><span className="mb-2 block h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${option.background}, ${option.ribbon})` }} />{option.name}</button>)}</div></fieldset>
                <fieldset className="mt-5" disabled={!photo || loading}><legend className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">Aplicação da fotografia</legend><div className="mt-2 grid grid-cols-2 gap-2">{GIFT_COMPOSITION_MODES.map((option) => <button key={option.id} type="button" onClick={() => setMode(option.id)} aria-pressed={mode === option.id} className={`min-h-12 rounded-xl border px-3 text-xs font-semibold ${mode === option.id ? 'border-[#fff1a1]/55 bg-[#fff1a1]/10 text-[#fff1a1]' : 'border-white/10 text-white/55'}`}>{option.name}</button>)}</div></fieldset>
              </section>}

              {step === 3 && <section aria-labelledby="gift-step-message">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#fff1a1]">Etapa 3 de 6</p><h3 id="gift-step-message" className="mt-2 text-xl font-semibold">Sua mensagem</h3><p className="mt-1 text-sm text-white/55">A mensagem secreta fica protegida e será liberada em 25/12.</p>
                {photo && <button type="button" onClick={() => setPreviewExpanded((value) => !value)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold text-white/70 md:hidden" aria-expanded={previewExpanded}>{previewExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{previewExpanded ? 'Recolher prévia' : 'Ver prévia do presente'}</button>}
                <div className="mt-5 space-y-4"><label className="block text-xs text-white/65">Seu nome<input value={senderName} onChange={(event) => setSenderName(event.target.value)} maxLength={40} autoComplete="name" className="mt-1 min-h-11 w-full scroll-mt-24 rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-[#fff1a1]/55" /></label><label className="block text-xs text-white/65">Mensagem secreta<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={4} className="mt-1 w-full scroll-mt-24 rounded-xl border border-white/15 bg-black/25 p-3 text-sm text-white outline-none focus:border-[#fff1a1]/55" /></label><label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/60"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Autorizo o uso da textura final na embalagem pública após a confirmação segura do pagamento.</span></label></div>
              </section>}

              {step === 4 && <section aria-labelledby="gift-step-review">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#fff1a1]">Etapa 4 de 6</p><h3 id="gift-step-review" className="mt-2 text-xl font-semibold">Confira o resultado</h3>
                <dl className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-white/45">Presente</dt><dd className="text-right font-semibold">{selectedProduct?.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/45">Embalagem</dt><dd className="text-right font-semibold">{GIFT_STYLES.find((item) => item.id === style)?.name} · {GIFT_COMPOSITION_MODES.find((item) => item.id === mode)?.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/45">Remetente</dt><dd className="text-right font-semibold">{senderName}</dd></div><div className="flex justify-between gap-4"><dt className="text-white/45">Valor</dt><dd className="text-right font-bold text-emerald-200">{selectedProduct && formatPrice(selectedProduct.amount_cents, selectedProduct.currency)}</dd></div></dl>
                <p className="mt-4 text-xs leading-relaxed text-white/50">Revise a prévia 3D. Ao continuar, o rascunho privado será preparado; nenhuma cobrança Pix será criada até sua confirmação na próxima etapa.</p>
              </section>}

              {step === 5 && <section aria-labelledby="gift-step-payment">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Etapa 5 de 6</p><h3 id="gift-step-payment" className="mt-2 text-xl font-semibold">Pagamento Pix</h3><p className="mt-1 text-sm text-white/55">Este presente ainda não foi publicado. Somente o backend pode publicar após a confirmação financeira.</p>
                {draft && !order && <div className="mt-5 space-y-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">{!paymentAvailable ? <p className="text-xs text-amber-100">O pagamento Pix está indisponível neste ambiente. Nenhuma cobrança foi criada.</p> : <><p className="text-sm font-semibold">{selectedProduct?.name} · {selectedProduct && formatPrice(selectedProduct.amount_cents, selectedProduct.currency)}</p><label className="block text-xs text-white/65">E-mail exigido pelo Mercado Pago<input type="email" autoComplete="email" value={payerEmail} onChange={(event) => { setPayerEmail(event.target.value); paymentIdempotencyKey.current = createGiftIdempotencyKey(); }} maxLength={160} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/50" placeholder="voce@exemplo.com" /></label><p className="text-[11px] text-white/40">O e-mail é enviado ao provedor para gerar o Pix e não é armazenado localmente.</p><button type="button" onClick={() => void startPayment()} disabled={!payerEmail.includes('@') || paying} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50">{paying && <Loader2 size={17} className="animate-spin" />}{paying ? 'Gerando Pix…' : 'Gerar pagamento Pix'}</button></>}<button type="button" onClick={() => void cancelDraft()} disabled={cancelling} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-300/20 px-4 text-xs text-red-100 hover:bg-red-400/10 disabled:opacity-50"><Trash2 size={14} />{cancelling ? 'Cancelando…' : 'Cancelar e voltar à revisão'}</button></div>}
                {order && <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4 text-center" aria-live="polite"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">{paymentStatusLabel[order.status]}</p><p className="mt-2 text-lg font-bold">{order.product_name} · {formatPrice(order.amount_cents, order.currency)}</p>{order.status === 'pending' && <>{order.pix_qr_code_base64 && <img src={`data:image/png;base64,${order.pix_qr_code_base64}`} alt="QR Code Pix" className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2" />}{order.pix_qr_code && <div className="mt-4"><textarea readOnly value={order.pix_qr_code} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-[10px] text-white/55" aria-label="Pix Copia e Cola" /><button type="button" onClick={() => void copyPix()} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-emerald-300/30 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/10"><Copy size={16} />{copied ? 'Código copiado' : 'Copiar código Pix'}</button></div>}{order.pix_ticket_url && <a href={order.pix_ticket_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200 underline"><ExternalLink size={14} />Abrir instruções no Mercado Pago</a>}<p className="mt-3 text-[11px] text-white/40">A confirmação ocorre de forma segura pelo provedor; somente o backend pode publicar o presente.</p></>}{order.status === 'paid' && order.publication_status !== 'published' && <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mx-auto mb-2" />Pagamento confirmado. Estamos preparando seu presente.</div>}{['expired', 'cancelled', 'failed'].includes(order.status) && <p className="mt-3 text-xs text-amber-100">Este pagamento não está ativo. Nenhuma publicação foi realizada.</p>}{order.status === 'refunded' && <p className="mt-3 text-xs text-amber-100">O pagamento foi reembolsado e o presente não está mais visível na árvore.</p>}</div>}
              </section>}

              {step === 6 && order?.status === 'paid' && order.publication_status === 'published' && <section className="text-center" aria-labelledby="gift-step-confirmation" aria-live="polite"><CheckCircle2 size={52} className="mx-auto text-emerald-300" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Etapa 6 de 6</p><h3 id="gift-step-confirmation" className="mt-2 text-2xl font-bold">Seu presente foi enviado!</h3><p className="mt-3 text-sm leading-relaxed text-white/65">O pagamento foi confirmado e o presente especial está esperando embaixo da árvore.</p><button type="button" onClick={onClose} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold hover:bg-emerald-400">Voltar para a árvore</button></section>}
            </div>

            {step <= 4 && <div className="sticky bottom-0 z-10 -mx-5 mt-7 flex items-center gap-3 border-t border-white/10 bg-[#07120d]/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:pt-5">{step > 1 && <button type="button" onClick={goBack} className="inline-flex min-h-12 items-center gap-1 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/70 hover:bg-white/5"><ChevronLeft size={18} />Voltar</button>}<button type="button" onClick={step === 4 ? () => void prepare() : () => setStep(nextGiftWizardStep(step, wizardInput))} disabled={step === 4 ? preparing : !canAdvanceGiftWizard(step, wizardInput)} className="ml-auto inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-5 text-sm font-semibold hover:bg-[#24cf70] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">{preparing && <Loader2 size={17} className="animate-spin" />}{step === 4 ? (preparing ? 'Preparando…' : 'Continuar para o Pix') : <>Continuar<ChevronRight size={18} /></>}</button></div>}
          </section>

          {previewMode !== 'hidden' && <section
            className={`order-1 relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#0d2018] to-[#020705] md:order-2 md:min-h-[36rem] md:border-b-0 md:border-l ${previewMode === 'compact' ? 'h-40' : 'h-[min(34dvh,17rem)] min-h-[13rem]'} md:h-auto`}
            data-preview-mode={previewMode}
            aria-label="Prévia 3D do presente"
          >
            {photo && previewTexture ? <>
              <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.25, 5.4], fov: 42 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[4, 6, 5]} intensity={2.2} color="#fff1c7" />
                <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#8eb7ff" />
                <PersonalizedGift texture={previewTexture} ribbonColor={selectedStyle.ribbon} />
                <OrbitControls makeDefault enablePan={false} minDistance={4.4} maxDistance={8.5} target={[0, 0.22, 0]} />
              </Canvas>
              <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/55 backdrop-blur min-[380px]:block md:bottom-4">Arraste para girar · aproxime com dois dedos</div>
              <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#fff1a1]/20 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-[#fff1a1] md:left-4 md:top-4 md:text-xs">🎁 Prévia da embalagem</div>
              {(step === 3 || step === 4) && <button type="button" onClick={() => setPreviewExpanded((value) => !value)} className="absolute right-3 top-3 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 text-[11px] font-semibold text-white/75 backdrop-blur md:hidden" aria-expanded={previewExpanded}>{previewExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{previewExpanded ? 'Recolher' : 'Expandir'}</button>}
            </> : <div className="flex h-full min-h-[13rem] flex-col items-center justify-center px-8 text-center text-white/35"><Gift size={42} strokeWidth={1.2} /><p className="mt-3 text-sm font-semibold text-white/55">Escolha uma fotografia para ativar a prévia 3D.</p></div>}
          </section>}
        </div>
      </div>
    </div>
  );
};

export default GiftPreviewModal;

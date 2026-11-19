import React, { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Copy, Download, Image as ImageIcon, Instagram, Link2, Loader2, Share2, Square, X } from 'lucide-react';
import {
  SOCIAL_SHARE_TEXT,
  copyText,
  downloadBlob,
  generateStoryCard,
  getTreeCanvas,
  shareStoryImage,
  shareTreeLink,
  storyFilename,
} from '../utils/socialSharing';
import type { StoryFrameCapture } from '../utils/socialSharing';
import {
  STORY_VIDEO_DURATION_MS,
  VideoRecordingCancelledError,
  VideoRecordingError,
  chooseStoryVideoProfile,
  createStoryVideoCanvas,
  drawStoryVideoFrame,
  isVideoRecordingSupported,
  recordCanvasVideo,
  shareStoryVideo,
  storyVideoFilename,
} from '../utils/videoRecording';
import type { StoryVideoSceneCapture } from '../utils/videoRecording';

interface ShareTreeModalProps {
  ownerName: string;
  ornamentCount: number;
  publicUrl: string;
  captureFrame?: StoryFrameCapture;
  startVideoCapture?: StoryVideoSceneCapture;
  onClose: () => void;
}

type VideoStatus = 'idle' | 'preparing' | 'recording' | 'ready' | 'unsupported';

const ShareTreeModal: React.FC<ShareTreeModalProps> = ({ ownerName, ornamentCount, publicUrl, captureFrame, startVideoCapture, onClose }) => {
  const [card, setCard] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [video, setVideo] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const videoAbort = useRef<AbortController | null>(null);
  const videoFrame = useRef<number | null>(null);

  const videoBusy = videoStatus === 'preparing' || videoStatus === 'recording';

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    videoAbort.current?.abort();
    if (videoFrame.current !== null) cancelAnimationFrame(videoFrame.current);
  }, []);

  useEffect(() => () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  const generateCard = async (): Promise<Blob | null> => {
    if (card) return card;
    setGenerating(true);
    setFeedback(null);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const sourceCanvas = captureFrame ? await captureFrame() : getTreeCanvas();
      const generated = await generateStoryCard({
        sourceCanvas,
        ownerName,
        ornamentCount,
      });
      const url = URL.createObjectURL(generated);
      setCard(generated);
      setPreviewUrl(url);
      setFeedback({ type: 'success', message: 'Cartão 9:16 gerado no seu dispositivo.' });
      return generated;
    } catch (caught) {
      if (import.meta.env.DEV) {
        console.error('Falha sanitizada ao gerar o cartão para Story.', {
          type: caught instanceof Error ? caught.name : typeof caught,
        });
      }
      setFeedback({ type: 'error', message: 'Não foi possível capturar a árvore agora. Aguarde a cena carregar e tente novamente.' });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyText(publicUrl);
      setFeedback({ type: 'success', message: 'Link público copiado!' });
    } catch (caught) {
      setFeedback({ type: 'error', message: caught instanceof Error ? caught.message : 'Copie o link exibido abaixo.' });
    }
  };

  const handleNativeShare = async () => {
    try {
      if (await shareTreeLink(publicUrl, ownerName)) {
        setFeedback({ type: 'success', message: 'Compartilhamento aberto.' });
      } else {
        await handleCopy();
        setFeedback({ type: 'success', message: 'Compartilhamento nativo indisponível; o link foi copiado.' });
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setFeedback({ type: 'error', message: 'Não foi possível abrir o compartilhamento. Você ainda pode copiar o link.' });
    }
  };

  const handleShareCard = async () => {
    const generated = await generateCard();
    if (!generated) return;
    try {
      if (await shareStoryImage(generated, ownerName)) {
        setFeedback({ type: 'success', message: 'Imagem pronta para compartilhar.' });
      } else {
        downloadBlob(generated, storyFilename(ownerName));
        setFeedback({ type: 'success', message: 'Seu navegador não compartilha arquivos; a imagem foi salva.' });
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setFeedback({ type: 'error', message: 'Não foi possível compartilhar a imagem. Use o botão para salvá-la.' });
    }
  };

  const handleDownload = async () => {
    const generated = await generateCard();
    if (!generated) return;
    downloadBlob(generated, storyFilename(ownerName));
    setFeedback({ type: 'success', message: 'Imagem salva no dispositivo.' });
  };

  const handleCreateVideo = async () => {
    if (videoBusy || !startVideoCapture) return;
    const profile = chooseStoryVideoProfile();
    const output = createStoryVideoCanvas(profile);
    if (!isVideoRecordingSupported(output)) {
      setVideoStatus('unsupported');
      setFeedback({ type: 'error', message: 'Seu navegador não permite criar vídeos diretamente. Você ainda pode compartilhar uma imagem da sua árvore!' });
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setVideo(null);
    setVideoProgress(0);
    setVideoStatus('preparing');
    setFeedback({ type: 'success', message: 'Preparando seu vídeo...' });
    const controller = new AbortController();
    videoAbort.current = controller;
    let sceneSession: Awaited<ReturnType<StoryVideoSceneCapture>> | null = null;

    try {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      sceneSession = await startVideoCapture({ ...profile, reducedMotion });
      const startedAt = performance.now();
      const renderFrame = () => {
        drawStoryVideoFrame(output, sceneSession!.canvas, ownerName, ornamentCount, performance.now() - startedAt);
        videoFrame.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();
      setVideoStatus('recording');
      setFeedback({ type: 'success', message: 'Gravando sua árvore...' });
      const result = await recordCanvasVideo({
        canvas: output,
        durationMs: STORY_VIDEO_DURATION_MS,
        fps: profile.fps,
        videoBitsPerSecond: profile.videoBitsPerSecond,
        signal: controller.signal,
        onProgress: setVideoProgress,
      });
      const url = URL.createObjectURL(result.blob);
      setVideo(result.blob);
      setVideoPreviewUrl(url);
      setVideoStatus('ready');
      setFeedback({ type: 'success', message: 'Seu vídeo está pronto!' });
    } catch (caught) {
      if (caught instanceof VideoRecordingCancelledError) {
        setVideoStatus('idle');
        setFeedback({ type: 'success', message: 'Gravação cancelada. Sua árvore voltou ao enquadramento normal.' });
      } else {
        const unsupported = caught instanceof VideoRecordingError && caught.code === 'unsupported';
        setVideoStatus(unsupported ? 'unsupported' : 'idle');
        setFeedback({
          type: 'error',
          message: unsupported
            ? 'Seu navegador não permite criar vídeos diretamente. Você ainda pode compartilhar uma imagem da sua árvore!'
            : 'Não foi possível concluir o vídeo. A imagem e o compartilhamento do link continuam disponíveis.',
        });
        if (import.meta.env.DEV) {
          console.error('Falha sanitizada ao gravar vídeo.', { type: caught instanceof Error ? caught.name : typeof caught });
        }
      }
    } finally {
      if (videoFrame.current !== null) cancelAnimationFrame(videoFrame.current);
      videoFrame.current = null;
      sceneSession?.stop();
      videoAbort.current = null;
    }
  };

  const handleCancelVideo = () => videoAbort.current?.abort();

  const handleDownloadVideo = () => {
    if (!video) return;
    downloadBlob(video, storyVideoFilename(ownerName, video.type));
    setFeedback({ type: 'success', message: 'Vídeo salvo no dispositivo.' });
  };

  const handleShareVideo = async () => {
    if (!video) return;
    try {
      if (await shareStoryVideo(video, ownerName)) {
        setFeedback({ type: 'success', message: 'Vídeo pronto para compartilhar.' });
      } else {
        handleDownloadVideo();
        setFeedback({ type: 'success', message: 'Seu navegador não compartilha este arquivo; o vídeo foi salvo.' });
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setFeedback({ type: 'error', message: 'Não foi possível compartilhar o vídeo. Você ainda pode salvá-lo.' });
    }
  };

  const handleClose = () => {
    videoAbort.current?.abort();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[98] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md pointer-events-auto" onPointerDown={(event) => event.stopPropagation()}>
      <section className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[#fff1a1]/20 bg-[#07120d]/95 p-5 text-white shadow-2xl md:p-7">
        <button type="button" onClick={handleClose} className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Fechar compartilhamento"><X size={20} /></button>
        <div className="pr-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#fff1a1]/65">Convide seus amigos</p>
          <h2 className="mt-2 text-2xl font-semibold">Compartilhar minha árvore 🎄</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{SOCIAL_SHARE_TEXT}</p>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45"><Link2 size={15} /> Link público</div>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={publicUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-white/75 outline-none" aria-label="Link público da árvore" />
            <button type="button" onClick={handleCopy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#fff1a1] hover:bg-white/15" aria-label="Copiar link"><Copy size={17} /></button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={handleNativeShare} disabled={videoBusy} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-5 py-3 font-semibold text-white hover:bg-[#24cf70] disabled:opacity-50"><Share2 size={18} /> Compartilhar link</button>
          <button type="button" onClick={generateCard} disabled={generating || videoBusy} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#fff1a1]/25 bg-[#fff1a1]/10 px-5 py-3 font-semibold text-[#fff1a1] hover:bg-[#fff1a1]/15 disabled:opacity-55">
            {generating ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />} Gerar cartão para Stories
          </button>
          <button type="button" onClick={handleCreateVideo} disabled={generating || videoBusy || !startVideoCapture} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#e1306c]/40 bg-[#e1306c]/15 px-5 py-3 font-semibold text-pink-100 hover:bg-[#e1306c]/25 disabled:opacity-50 sm:col-span-2">
            {videoBusy ? <Loader2 size={18} className="animate-spin" /> : <Clapperboard size={18} />}
            {videoStatus === 'preparing' ? 'Preparando seu vídeo...' : videoStatus === 'recording' ? 'Gravando sua árvore...' : 'Criar vídeo para Stories'}
          </button>
        </div>

        {videoBusy && (
          <div className="mt-4 rounded-2xl border border-pink-300/15 bg-pink-300/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-pink-100">{videoStatus === 'preparing' ? 'Preparando composição vertical' : `Gravando ${Math.round(videoProgress * 100)}%`}</span>
              <button type="button" onClick={handleCancelVideo} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/10"><Square size={12} /> Cancelar</button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progresso da gravação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(videoProgress * 100)}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#e1306c] to-[#fff1a1] transition-[width] duration-100" style={{ width: `${Math.max(2, videoProgress * 100)}%` }} />
            </div>
          </div>
        )}

        {videoStatus === 'unsupported' && (
          <p className="mt-4 rounded-2xl border border-[#fff1a1]/15 bg-[#fff1a1]/5 p-4 text-sm leading-relaxed text-white/65">Use o cartão PNG acima como alternativa. O compartilhamento do link continua funcionando normalmente.</p>
        )}

        {videoPreviewUrl && video && (
          <div className="mt-5 grid items-center gap-5 rounded-2xl border border-pink-300/15 bg-black/25 p-4 sm:grid-cols-[180px_1fr]">
            <video src={videoPreviewUrl} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] max-h-[360px] rounded-xl border border-white/10 bg-black object-cover shadow-xl" aria-label={`Vídeo vertical da árvore de ${ownerName}`} />
            <div>
              <div className="flex items-center gap-2 text-pink-100"><Clapperboard size={20} /><span className="font-semibold">Seu vídeo está pronto!</span></div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">O formato disponível neste navegador é {video.type.includes('mp4') ? 'MP4' : 'WebM'}. Adicione manualmente o adesivo de link ao publicar.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" onClick={handleShareVideo} className="flex items-center justify-center gap-2 rounded-full bg-[#e1306c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#f04a82]"><Share2 size={16} /> Compartilhar vídeo</button>
                <button type="button" onClick={handleDownloadVideo} className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"><Download size={16} /> Salvar vídeo</button>
              </div>
            </div>
          </div>
        )}

        {previewUrl && (
          <div className="mt-5 grid items-center gap-5 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[180px_1fr]">
            <img src={previewUrl} alt={`Cartão vertical da árvore de ${ownerName}`} className="mx-auto aspect-[9/16] max-h-[360px] rounded-xl border border-white/10 object-cover shadow-xl" />
            <div>
              <div className="flex items-center gap-2 text-[#fff1a1]"><Instagram size={20} /><span className="font-semibold">Pronto para os Stories</span></div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">Publique a imagem nos Stories e adicione o adesivo de link para seus amigos decorarem sua árvore.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" onClick={handleShareCard} className="flex items-center justify-center gap-2 rounded-full bg-[#e1306c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#f04a82]"><Share2 size={16} /> Compartilhar imagem</button>
                <button type="button" onClick={handleDownload} className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"><Download size={16} /> Salvar imagem</button>
              </div>
            </div>
          </div>
        )}

        {feedback && <p className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${feedback.type === 'success' ? 'border-green-400/20 bg-green-400/10 text-green-100' : 'border-red-400/20 bg-red-400/10 text-red-100'}`}>{feedback.type === 'success' && <Check size={16} />}{feedback.message}</p>}
      </section>
    </div>
  );
};

export default ShareTreeModal;

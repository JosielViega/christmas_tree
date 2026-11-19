export const STORY_VIDEO_DURATION_MS = 8_000;

export const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

export interface StoryVideoProfile {
  width: 720 | 1080;
  height: 1280 | 1920;
  fps: 24 | 30;
  videoBitsPerSecond: number;
}

export interface StoryVideoSceneOptions extends StoryVideoProfile {
  reducedMotion: boolean;
}

export interface StoryVideoSceneSession {
  canvas: HTMLCanvasElement;
  stop: () => void;
}

export type StoryVideoSceneCapture = (options: StoryVideoSceneOptions) => Promise<StoryVideoSceneSession>;

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  extension: 'mp4' | 'webm';
}

export type MediaRecorderConstructor = {
  new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported?: (mimeType: string) => boolean;
};

export interface RecordingEnvironment {
  MediaRecorder: MediaRecorderConstructor | null;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  now: () => number;
}

export interface RecordCanvasVideoOptions {
  canvas: HTMLCanvasElement;
  durationMs?: number;
  fps?: number;
  videoBitsPerSecond?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  environment?: RecordingEnvironment;
}

export class VideoRecordingError extends Error {
  readonly code: 'unsupported' | 'initialization' | 'recording' | 'empty';

  constructor(message: string, code: 'unsupported' | 'initialization' | 'recording' | 'empty') {
    super(message);
    this.name = 'VideoRecordingError';
    this.code = code;
  }
}

export class VideoRecordingCancelledError extends Error {
  constructor() {
    super('A gravação foi cancelada.');
    this.name = 'VideoRecordingCancelledError';
  }
}

export const getMediaRecorderConstructor = (scope: typeof globalThis = globalThis): MediaRecorderConstructor | null => {
  return (scope as typeof globalThis & { MediaRecorder?: MediaRecorderConstructor }).MediaRecorder ?? null;
};

export const selectVideoMimeType = (constructor: MediaRecorderConstructor | null): string => {
  if (!constructor || typeof constructor.isTypeSupported !== 'function') return '';
  for (const mimeType of VIDEO_MIME_CANDIDATES) {
    try {
      if (constructor.isTypeSupported(mimeType)) return mimeType;
    } catch {
      // A broken codec probe must fall through to the recorder default.
    }
  }
  return '';
};

export const isVideoRecordingSupported = (
  canvas: Pick<HTMLCanvasElement, 'captureStream'> | null,
  constructor: MediaRecorderConstructor | null = getMediaRecorderConstructor(),
): boolean => Boolean(constructor && canvas && typeof canvas.captureStream === 'function');

export const chooseStoryVideoProfile = (hardware: { deviceMemory?: number; hardwareConcurrency?: number } = navigator): StoryVideoProfile => {
  const capableMemory = typeof hardware.deviceMemory === 'number' && hardware.deviceMemory >= 8;
  const capableCpu = typeof hardware.hardwareConcurrency === 'number' && hardware.hardwareConcurrency >= 8;
  if (capableMemory && capableCpu) {
    return { width: 1080, height: 1920, fps: 30, videoBitsPerSecond: 8_000_000 };
  }
  return { width: 720, height: 1280, fps: 24, videoBitsPerSecond: 4_000_000 };
};

export const videoExtension = (mimeType: string): 'mp4' | 'webm' => mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';

export const storyVideoFilename = (ownerName: string, mimeType: string): string => {
  const safeName = ownerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `video-arvore-${safeName || 'natal'}.${videoExtension(mimeType)}`;
};

export const shareStoryVideo = async (blob: Blob, ownerName: string, target: Navigator = navigator): Promise<boolean> => {
  if (typeof File !== 'function' || typeof target.share !== 'function' || typeof target.canShare !== 'function') return false;
  const file = new File([blob], storyVideoFilename(ownerName, blob.type), { type: blob.type });
  try {
    if (!target.canShare({ files: [file] })) return false;
  } catch {
    return false;
  }
  await target.share({
    title: `Vídeo da árvore de ${ownerName}`,
    text: 'Publique nos Stories ou Reels e adicione o adesivo de link para seus amigos decorarem sua árvore.',
    files: [file],
  });
  return true;
};

export const buildStoryVideoCopy = (ownerName: string, ornamentCount: number) => ({
  ownerName,
  participation: ornamentCount === 1 ? '1 amigo já decorou' : `${ornamentCount} amigos já decoraram`,
  invitation: '🎁 Deixe sua mensagem secreta!',
  callToAction: '🎄 Decore minha árvore!',
  brand: 'CHRISTMAS TREE',
});

export const createStoryVideoCanvas = (profile: StoryVideoProfile): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = profile.width;
  canvas.height = profile.height;
  return canvas;
};

export const drawStoryVideoFrame = (
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  ownerName: string,
  ornamentCount: number,
  elapsedMs: number,
): void => {
  const context = output.getContext('2d');
  if (!context) throw new VideoRecordingError('Não foi possível preparar a composição do vídeo.', 'recording');

  const width = output.width;
  const height = output.height;
  const scale = width / 1080;
  const copy = buildStoryVideoCopy(ownerName, ornamentCount);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#020504';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  const topShade = context.createLinearGradient(0, 0, 0, height * 0.26);
  topShade.addColorStop(0, 'rgba(2, 5, 4, 0.9)');
  topShade.addColorStop(1, 'rgba(2, 5, 4, 0)');
  context.fillStyle = topShade;
  context.fillRect(0, 0, width, height * 0.3);

  const bottomShade = context.createLinearGradient(0, height * 0.62, 0, height);
  bottomShade.addColorStop(0, 'rgba(2, 5, 4, 0)');
  bottomShade.addColorStop(1, 'rgba(2, 5, 4, 0.94)');
  context.fillStyle = bottomShade;
  context.fillRect(0, height * 0.6, width, height * 0.4);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0, 0, 0, 0.8)';
  context.shadowBlur = 18 * scale;

  if (elapsedMs < 3_000) {
    context.fillStyle = '#fff1a1';
    context.font = `700 ${Math.round(54 * scale)}px "Segoe UI", sans-serif`;
    context.fillText('🎄 Árvore de Natal de', width / 2, height * 0.095, width * 0.86);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.round(72 * scale)}px "Segoe UI", sans-serif`;
    context.fillText(copy.ownerName, width / 2, height * 0.145, width * 0.86);
    context.fillStyle = 'rgba(255,255,255,0.78)';
    context.font = `600 ${Math.round(34 * scale)}px "Segoe UI", sans-serif`;
    context.fillText(`✨ ${copy.participation}`, width / 2, height * 0.19, width * 0.86);
  }

  if (elapsedMs >= 5_200) {
    context.fillStyle = '#fff1a1';
    context.font = `700 ${Math.round(46 * scale)}px "Segoe UI", sans-serif`;
    context.fillText(copy.invitation, width / 2, height * 0.79, width * 0.9);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.round(54 * scale)}px "Segoe UI", sans-serif`;
    context.fillText(copy.callToAction, width / 2, height * 0.845, width * 0.9);
  }

  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,255,255,0.48)';
  context.font = `600 ${Math.round(24 * scale)}px "Segoe UI", sans-serif`;
  context.fillText(copy.brand, width / 2, height * 0.925);
};

export const recordCanvasVideo = ({
  canvas,
  durationMs = STORY_VIDEO_DURATION_MS,
  fps = 30,
  videoBitsPerSecond = 8_000_000,
  signal,
  onProgress,
  environment = browserRecordingEnvironment(),
}: RecordCanvasVideoOptions): Promise<RecordingResult> => new Promise((resolve, reject) => {
  if (!isVideoRecordingSupported(canvas, environment.MediaRecorder)) {
    reject(new VideoRecordingError('Este navegador não permite gravar vídeos diretamente.', 'unsupported'));
    return;
  }

  let stream: MediaStream;
  let tracks: MediaStreamTrack[];
  try {
    stream = canvas.captureStream(fps);
    tracks = stream.getTracks();
  } catch {
    reject(new VideoRecordingError('O navegador não conseguiu preparar o stream do vídeo.', 'initialization'));
    return;
  }
  const mimeType = selectVideoMimeType(environment.MediaRecorder);
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  let settled = false;
  let cancelled = false;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  const startedAt = environment.now();

  const cleanup = () => {
    if (stopTimer !== undefined) environment.clearTimeout(stopTimer);
    if (progressTimer !== undefined) environment.clearInterval(progressTimer);
    signal?.removeEventListener('abort', abort);
    tracks.forEach((track) => track.stop());
  };

  const finishWithError = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  };

  const abort = () => {
    if (settled) return;
    cancelled = true;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else finishWithError(new VideoRecordingCancelledError());
  };

  try {
    recorder = new environment.MediaRecorder!(stream, mimeType ? { mimeType, videoBitsPerSecond } : { videoBitsPerSecond });
  } catch {
    try {
      recorder = new environment.MediaRecorder!(stream);
    } catch {
      finishWithError(new VideoRecordingError('Não foi possível iniciar o gravador neste dispositivo.', 'initialization'));
      return;
    }
  }

  recorder.ondataavailable = (event) => {
    if (event.data?.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => finishWithError(new VideoRecordingError('A gravação foi interrompida pelo navegador.', 'recording'));
  recorder.onstop = () => {
    if (settled) return;
    if (cancelled) {
      finishWithError(new VideoRecordingCancelledError());
      return;
    }
    if (chunks.length === 0) {
      finishWithError(new VideoRecordingError('Nenhum frame foi produzido durante a gravação.', 'empty'));
      return;
    }
    settled = true;
    cleanup();
    onProgress?.(1);
    const finalType = recorder.mimeType || chunks[0].type || mimeType || 'video/webm';
    resolve({
      blob: new Blob(chunks, { type: finalType }),
      mimeType: finalType,
      extension: videoExtension(finalType),
    });
  };

  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) {
    abort();
    return;
  }

  try {
    onProgress?.(0);
    recorder.start();
    if (settled) return;
    progressTimer = environment.setInterval(() => {
      onProgress?.(Math.min(0.99, (environment.now() - startedAt) / durationMs));
    }, 100);
    stopTimer = environment.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  } catch {
    finishWithError(new VideoRecordingError('O navegador recusou o início da gravação.', 'initialization'));
  }
});

const browserRecordingEnvironment = (): RecordingEnvironment => ({
  MediaRecorder: getMediaRecorderConstructor(),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  now: () => performance.now(),
});

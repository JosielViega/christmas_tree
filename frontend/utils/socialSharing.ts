export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_SCENE_WIDTH = 900;
export const STORY_SCENE_HEIGHT = 1100;
export const SOCIAL_SHARE_TEXT = '🎄 Criei minha árvore de Natal! Decore com um enfeite e deixe uma mensagem secreta para eu abrir no Natal! ❤️';

export type StoryFrameCapture = () => Promise<HTMLCanvasElement>;

export interface StoryCardInput {
  sourceCanvas: HTMLCanvasElement;
  ownerName: string;
  ornamentCount: number;
}

export const buildStoryCardCopy = (ownerName: string, ornamentCount: number) => ({
  heading: '🎄 Árvore de Natal de',
  ownerName,
  friendLabel: ornamentCount === 1 ? '1 amigo já decorou!' : `${ornamentCount} amigos já decoraram!`,
  invitation: '🎁 Deixe sua mensagem secreta!',
  callToAction: 'Decore minha árvore 🎄',
  linkHint: 'Acesse pelo link do Story',
  brand: 'CHRISTMAS TREE',
});

export interface DownloadEnvironment {
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  createLink: () => Pick<HTMLAnchorElement, 'href' | 'download' | 'click'>;
  defer: (callback: () => void) => void;
}

export const withTemporaryCaptureState = async <State, Result>(
  snapshot: () => State,
  prepare: () => void,
  capture: () => Promise<Result>,
  restore: (state: State) => void,
): Promise<Result> => {
  const state = snapshot();
  try {
    prepare();
    return await capture();
  } finally {
    restore(state);
  }
};

export const buildPublicTreeUrl = (publicId: string, origin = window.location.origin): string => {
  const url = new URL(origin);
  url.username = '';
  url.password = '';
  url.pathname = `/t/${encodeURIComponent(publicId)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
};

export const fitContain = (sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) => {
  if (sourceWidth <= 0 || sourceHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    throw new Error('Dimensões inválidas para a captura.');
  }
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
};

export const getTreeCanvas = (root: Pick<Document, 'querySelector'> = document): HTMLCanvasElement => {
  const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas || typeof canvas.width !== 'number' || typeof canvas.height !== 'number' || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('Não foi possível capturar a árvore 3D. Tente novamente após ela terminar de carregar.');
  }
  return canvas;
};

export const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('A cópia automática não está disponível neste navegador.');
};

export const shareTreeLink = async (publicUrl: string, ownerName: string): Promise<boolean> => {
  if (typeof navigator.share !== 'function') return false;
  await navigator.share({
    title: `🎄 Árvore de Natal de ${ownerName}`,
    text: SOCIAL_SHARE_TEXT,
    url: publicUrl,
  });
  return true;
};

export const canShareFiles = (files: File[], target: Pick<Navigator, 'share' | 'canShare'> = navigator): boolean => {
  return typeof target.share === 'function'
    && typeof target.canShare === 'function'
    && target.canShare({ files });
};

export const shareStoryImage = async (blob: Blob, ownerName: string): Promise<boolean> => {
  if (typeof File !== 'function') return false;
  const file = new File([blob], storyFilename(ownerName), { type: 'image/png' });
  if (!canShareFiles([file])) return false;
  await navigator.share({
    title: `Story da árvore de ${ownerName}`,
    text: 'Publique a imagem nos Stories e adicione o adesivo de link para seus amigos decorarem sua árvore.',
    files: [file],
  });
  return true;
};

export const storyFilename = (ownerName: string): string => {
  const safeName = ownerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `story-arvore-${safeName || 'natal'}.png`;
};

export const downloadBlob = (blob: Blob, filename: string, environment: DownloadEnvironment = browserDownloadEnvironment()): void => {
  const url = environment.createObjectUrl(blob);
  const link = environment.createLink();
  link.href = url;
  link.download = filename;
  link.click();
  environment.defer(() => environment.revokeObjectUrl(url));
};

const browserDownloadEnvironment = (): DownloadEnvironment => ({
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createLink: () => document.createElement('a'),
  defer: (callback) => window.setTimeout(callback, 0),
});

export const generateStoryCard = async ({ sourceCanvas, ownerName, ornamentCount }: StoryCardInput): Promise<Blob> => {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
    throw new Error('A captura da árvore está vazia.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não conseguiu preparar o cartão.');
  const copy = buildStoryCardCopy(ownerName, ornamentCount);

  const background = context.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  background.addColorStop(0, '#020807');
  background.addColorStop(0.55, '#071a12');
  background.addColorStop(1, '#020504');
  context.fillStyle = background;
  context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  context.fillStyle = 'rgba(255, 241, 161, 0.7)';
  for (let index = 0; index < 90; index++) {
    const x = (index * 173) % STORY_WIDTH;
    const y = (index * 257) % STORY_HEIGHT;
    const radius = 1 + (index % 3);
    context.globalAlpha = 0.2 + ((index % 5) * 0.12);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.textAlign = 'center';
  context.fillStyle = '#fff1a1';
  context.shadowColor = 'rgba(255, 210, 90, 0.35)';
  context.shadowBlur = 24;
  context.font = '700 54px "Segoe UI", sans-serif';
  context.fillText(copy.heading, STORY_WIDTH / 2, 135);
  context.font = '700 76px "Segoe UI", sans-serif';
  drawFittedText(context, copy.ownerName, STORY_WIDTH / 2, 225, 900, 76);
  context.shadowBlur = 0;

  const imageArea = { x: 50, y: 285, width: 980, height: 1110 };
  roundedRect(context, imageArea.x, imageArea.y, imageArea.width, imageArea.height, 56);
  context.fillStyle = 'rgba(0, 0, 0, 0.38)';
  context.fill();
  context.save();
  roundedRect(context, imageArea.x, imageArea.y, imageArea.width, imageArea.height, 56);
  context.clip();
  const fitted = fitContain(sourceCanvas.width, sourceCanvas.height, imageArea.width, imageArea.height);
  context.drawImage(
    sourceCanvas,
    imageArea.x + (imageArea.width - fitted.width) / 2,
    imageArea.y + (imageArea.height - fitted.height) / 2,
    fitted.width,
    fitted.height,
  );
  const fade = context.createLinearGradient(0, imageArea.y, 0, imageArea.y + imageArea.height);
  fade.addColorStop(0, 'rgba(2, 8, 7, 0.08)');
  fade.addColorStop(0.72, 'rgba(2, 8, 7, 0.12)');
  fade.addColorStop(1, 'rgba(2, 8, 7, 0.72)');
  context.fillStyle = fade;
  context.fillRect(imageArea.x, imageArea.y, imageArea.width, imageArea.height);
  context.restore();

  context.fillStyle = '#ffffff';
  context.font = '700 58px "Segoe UI", sans-serif';
  context.fillText(`✨ ${copy.friendLabel}`, STORY_WIDTH / 2, 1490);
  context.fillStyle = '#fff1a1';
  context.font = '700 52px "Segoe UI", sans-serif';
  context.fillText(copy.invitation, STORY_WIDTH / 2, 1590);

  context.strokeStyle = 'rgba(255, 241, 161, 0.28)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(220, 1660);
  context.lineTo(860, 1660);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '700 46px "Segoe UI", sans-serif';
  context.fillText(copy.callToAction, STORY_WIDTH / 2, 1730);
  context.fillStyle = 'rgba(255,255,255,0.68)';
  context.font = '600 31px "Segoe UI", sans-serif';
  context.fillText(copy.linkHint, STORY_WIDTH / 2, 1785);
  context.fillStyle = 'rgba(255,255,255,0.42)';
  context.font = '600 24px "Segoe UI", sans-serif';
  context.fillText(copy.brand, STORY_WIDTH / 2, 1840);

  return canvasToBlob(canvas);
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível finalizar a imagem.')), 'image/png', 1);
});

const drawFittedText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, initialSize: number) => {
  let size = initialSize;
  while (size > 38 && context.measureText(text).width > maxWidth) {
    size -= 2;
    context.font = `700 ${size}px "Segoe UI", sans-serif`;
  }
  context.fillText(text, x, y, maxWidth);
};

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

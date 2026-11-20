import * as THREE from 'three';

export type GiftWrappingPattern = 'solid' | 'stripes' | 'dots' | 'checkers';
export type GiftStyleId = 'classic' | 'magic' | 'romantic';
export type GiftCompositionMode = 'repeated' | 'featured';

export interface GiftStyle {
  id: GiftStyleId;
  name: string;
  background: string;
  frame: string;
  accent: string;
  ribbon: string;
}

export const GIFT_STYLES: readonly GiftStyle[] = [
  { id: 'classic', name: 'Natal clássico', background: '#0b3b2a', frame: '#d9b85f', accent: '#fff1a1', ribbon: '#b8182c' },
  { id: 'magic', name: 'Natal mágico', background: '#081b3d', frame: '#c9d7e8', accent: '#9edcff', ribbon: '#92a9c9' },
  { id: 'romantic', name: 'Romântico', background: '#761d39', frame: '#f2a6b8', accent: '#ffd4df', ribbon: '#d73d68' },
] as const;

export const GIFT_COMPOSITION_MODES: readonly { id: GiftCompositionMode; name: string }[] = [
  { id: 'repeated', name: 'Foto repetida' },
  { id: 'featured', name: 'Foto em destaque' },
] as const;

export const GIFT_TEXTURE_SIZE = 512;
export const DEFAULT_GIFT_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const MAX_CONFIGURABLE_GIFT_PHOTO_BYTES = 32 * 1024 * 1024;
export const GIFT_PHOTO_MIN_DIMENSION = 32;
export const GIFT_PHOTO_MAX_DIMENSION = 12_000;
export const GIFT_PHOTO_MAX_PIXELS = 40_000_000;

export type SupportedGiftPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface DecodedGiftPhoto {
  source: CanvasImageSource;
  width: number;
  height: number;
  mime: SupportedGiftPhotoMime;
  dispose: () => void;
}

export const replaceDecodedGiftPhoto = (current: DecodedGiftPhoto | null, next: DecodedGiftPhoto | null): DecodedGiftPhoto | null => {
  if (current && current !== next) current.dispose();
  return next;
};

export class GiftPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GiftPhotoError';
  }
}

export const isGiftPreviewEnabled = (development: boolean, configuredValue?: string): boolean => {
  return development || configuredValue === 'true';
};

export const getGiftPhotoMaxBytes = (configuredValue?: string): number => {
  const parsed = Number(configuredValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GIFT_PHOTO_MAX_BYTES;
  return Math.min(Math.floor(parsed), MAX_CONFIGURABLE_GIFT_PHOTO_BYTES);
};

export const detectGiftPhotoMime = (bytes: Uint8Array): SupportedGiftPhotoMime | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
};

export const validateGiftPhotoDimensions = (width: number, height: number): void => {
  if (!Number.isFinite(width) || !Number.isFinite(height)
    || width < GIFT_PHOTO_MIN_DIMENSION || height < GIFT_PHOTO_MIN_DIMENSION
    || width > GIFT_PHOTO_MAX_DIMENSION || height > GIFT_PHOTO_MAX_DIMENSION
    || width * height > GIFT_PHOTO_MAX_PIXELS) {
    throw new GiftPhotoError('A fotografia possui dimensões inválidas ou grandes demais.');
  }
};

export const validateGiftPhotoFile = async (file: File, maxBytes = DEFAULT_GIFT_PHOTO_MAX_BYTES): Promise<SupportedGiftPhotoMime> => {
  if (file.size <= 0) throw new GiftPhotoError('O arquivo selecionado está vazio.');
  if (file.size > maxBytes) throw new GiftPhotoError(`A fotografia deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectGiftPhotoMime(bytes);
  if (!detected) throw new GiftPhotoError('Selecione uma fotografia JPEG, PNG ou WebP válida.');
  const declaredType = file.type.toLowerCase();
  if (declaredType && declaredType !== detected && !(declaredType === 'image/jpg' && detected === 'image/jpeg')) {
    throw new GiftPhotoError('O conteúdo da fotografia não corresponde ao formato informado.');
  }
  return detected;
};

export interface GiftPhotoDecodeEnvironment {
  createImageBitmap?: typeof createImageBitmap;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createImage: () => HTMLImageElement;
}

const browserDecodeEnvironment = (): GiftPhotoDecodeEnvironment => ({
  createImageBitmap: typeof createImageBitmap === 'function' ? createImageBitmap : undefined,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  createImage: () => new Image(),
});

export const decodeGiftPhoto = async (
  file: File,
  maxBytes = DEFAULT_GIFT_PHOTO_MAX_BYTES,
  environment: GiftPhotoDecodeEnvironment = browserDecodeEnvironment(),
): Promise<DecodedGiftPhoto> => {
  const mime = await validateGiftPhotoFile(file, maxBytes);
  try {
    if (environment.createImageBitmap) {
      let bitmap: ImageBitmap;
      try {
        bitmap = await environment.createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        bitmap = await environment.createImageBitmap(file);
      }
      try {
        validateGiftPhotoDimensions(bitmap.width, bitmap.height);
      } catch (error) {
        bitmap.close();
        throw error;
      }
      return { source: bitmap, width: bitmap.width, height: bitmap.height, mime, dispose: () => bitmap.close() };
    }

    const objectUrl = environment.createObjectURL(file);
    const image = environment.createImage();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new GiftPhotoError('Não foi possível decodificar a fotografia.'));
        image.src = objectUrl;
      });
      validateGiftPhotoDimensions(image.naturalWidth, image.naturalHeight);
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        mime,
        dispose: () => {
          image.src = '';
          environment.revokeObjectURL(objectUrl);
        },
      };
    } catch (error) {
      environment.revokeObjectURL(objectUrl);
      throw error;
    }
  } catch (error) {
    if (error instanceof GiftPhotoError) throw error;
    throw new GiftPhotoError('Não foi possível decodificar a fotografia.');
  }
};

export const calculateCoverCrop = (sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) => {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { sx: (sourceWidth - width) / 2, sy: 0, sw: width, sh: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { sx: 0, sy: (sourceHeight - height) / 2, sw: sourceWidth, sh: height };
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

const drawPhotoCover = (
  context: CanvasRenderingContext2D,
  photo: DecodedGiftPhoto,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const crop = calculateCoverCrop(photo.width, photo.height, width, height);
  context.drawImage(photo.source, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height);
};

const drawMotif = (context: CanvasRenderingContext2D, style: GiftStyleId, x: number, y: number, size: number, color: string) => {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.globalAlpha = 0.62;
  context.lineWidth = Math.max(2, size * 0.1);
  if (style === 'classic') {
    context.beginPath();
    for (let point = 0; point < 10; point++) {
      const radius = point % 2 === 0 ? size : size * 0.42;
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
  } else if (style === 'magic') {
    for (let arm = 0; arm < 3; arm++) {
      context.rotate(Math.PI / 3);
      context.beginPath();
      context.moveTo(-size, 0);
      context.lineTo(size, 0);
      context.stroke();
    }
  } else {
    context.beginPath();
    context.moveTo(0, size * 0.75);
    context.bezierCurveTo(-size * 1.35, -size * 0.05, -size * 0.75, -size, 0, -size * 0.35);
    context.bezierCurveTo(size * 0.75, -size, size * 1.35, -size * 0.05, 0, size * 0.75);
    context.fill();
  }
  context.restore();
};

const fillPatternBackground = (context: CanvasRenderingContext2D, style: GiftStyle, size: number) => {
  context.fillStyle = style.background;
  context.fillRect(0, 0, size, size);
  for (let y = 42; y < size; y += 86) {
    for (let x = 42; x < size; x += 86) {
      drawMotif(context, style.id, x + ((y / 86) % 2) * 22, y, 8, style.accent);
    }
  }
};

const drawFramedPhoto = (context: CanvasRenderingContext2D, photo: DecodedGiftPhoto, style: GiftStyle, x: number, y: number, size: number) => {
  const border = Math.max(5, Math.round(size * 0.08));
  roundedRect(context, x, y, size, size, Math.max(8, size * 0.09));
  context.fillStyle = style.frame;
  context.fill();
  context.save();
  roundedRect(context, x + border, y + border, size - border * 2, size - border * 2, Math.max(5, size * 0.06));
  context.clip();
  drawPhotoCover(context, photo, x + border, y + border, size - border * 2, size - border * 2);
  context.restore();
};

export interface PersonalizedGiftCanvases {
  paper: HTMLCanvasElement;
  front: HTMLCanvasElement | null;
}

export const createPersonalizedGiftCanvases = (
  photo: DecodedGiftPhoto,
  styleId: GiftStyleId,
  mode: GiftCompositionMode,
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): PersonalizedGiftCanvases => {
  const style = GIFT_STYLES.find((candidate) => candidate.id === styleId) ?? GIFT_STYLES[0];
  const paper = createCanvas();
  paper.width = GIFT_TEXTURE_SIZE;
  paper.height = GIFT_TEXTURE_SIZE;
  const paperContext = paper.getContext('2d');
  if (!paperContext) throw new GiftPhotoError('O navegador não conseguiu preparar a textura do presente.');
  fillPatternBackground(paperContext, style, GIFT_TEXTURE_SIZE);

  if (mode === 'repeated') {
    const tileSize = 118;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const x = 24 + column * 160 + (row % 2) * 12;
        const y = 24 + row * 160;
        drawFramedPhoto(paperContext, photo, style, x, y, tileSize);
      }
    }
    return { paper, front: null };
  }

  const front = createCanvas();
  front.width = GIFT_TEXTURE_SIZE;
  front.height = GIFT_TEXTURE_SIZE;
  const frontContext = front.getContext('2d');
  if (!frontContext) throw new GiftPhotoError('O navegador não conseguiu preparar a face do presente.');
  fillPatternBackground(frontContext, style, GIFT_TEXTURE_SIZE);
  drawFramedPhoto(frontContext, photo, style, 70, 70, 372);
  return { paper, front };
};

export const createCanvasTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
};

export const createProceduralGiftTexture = (color: string, type: GiftWrappingPattern): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = GIFT_TEXTURE_SIZE;
  canvas.height = GIFT_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = color;
  context.fillRect(0, 0, GIFT_TEXTURE_SIZE, GIFT_TEXTURE_SIZE);
  if (type !== 'solid') {
    context.fillStyle = 'rgba(255, 255, 255, 0.15)';
    if (type === 'stripes') {
      context.save();
      context.translate(256, 256);
      context.rotate(Math.PI / 4);
      context.translate(-512, -512);
      for (let x = 0; x < 1024; x += 80) context.fillRect(x, 0, 40, 1024);
      context.restore();
    } else if (type === 'dots') {
      for (let x = 0; x < 512; x += 60) {
        for (let y = 0; y < 512; y += 60) {
          context.beginPath();
          context.arc(x + ((y / 60) % 2 === 0 ? 0 : 30), y, 10, 0, Math.PI * 2);
          context.fill();
        }
      }
    } else {
      for (let x = 0; x < 512; x += 64) {
        for (let y = 0; y < 512; y += 64) {
          if ((x / 64 + y / 64) % 2 === 0) context.fillRect(x, y, 64, 64);
        }
      }
    }
  }
  return createCanvasTexture(canvas);
};

export const disposeGiftTextures = (textures: readonly Pick<THREE.Texture, 'dispose'>[]): void => {
  textures.forEach((texture) => texture.dispose());
};

export const selectPersistedGiftCanvas = (canvases: PersonalizedGiftCanvases, mode: GiftCompositionMode): HTMLCanvasElement => {
  return mode === 'featured' && canvases.front ? canvases.front : canvases.paper;
};

export const giftCanvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob?.type === 'image/png' && blob.size > 0) resolve(blob);
    else reject(new GiftPhotoError('O navegador não conseguiu finalizar a textura do presente.'));
  }, 'image/png');
});

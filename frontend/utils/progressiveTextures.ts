import * as THREE from 'three';
import { markStartup, measureStartup } from './startup.ts';
import { calculateContainRect } from './imageFit.ts';

export const POLAROID_TEXTURE_MAX_SIZE = 512;
export const POLAROID_TEXTURE_CONCURRENCY = 2;

export const fittedTextureSize = (width: number, height: number, maxSize = POLAROID_TEXTURE_MAX_SIZE) => {
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

export const estimatedRgbaBytes = (width: number, height: number): number => width * height * 4;

export class TaskQueue {
  private active = 0;
  private readonly pending: Array<() => void> = [];
  readonly concurrency: number;
  constructor(concurrency = POLAROID_TEXTURE_CONCURRENCY) { this.concurrency = concurrency; }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        void task().then(resolve, reject).finally(() => {
          this.active--;
          this.pending.shift()?.();
        });
      };
      if (this.active < this.concurrency) start(); else this.pending.push(start);
    });
  }
}

export type TextureDiagnosticEvent =
  | 'queued'
  | 'loading'
  | 'decoded'
  | 'created'
  | 'applied'
  | 'unavailable'
  | 'disposed';

type TextureDiagnostic = (event: TextureDiagnosticEvent, resourceId: number, reason?: string) => void;
type TextureProgress = (event: 'loading' | 'decoded', reason?: string) => void;
type DisposableTexture = { dispose: () => void };

const developmentDiagnostic: TextureDiagnostic = (event, resourceId, reason) => {
  if (!import.meta.env.DEV) return;
  console.debug('[memory-texture]', { event, resourceId, ...(reason ? { reason } : {}) });
};

interface CachedTexture<T> {
  id: number;
  promise: Promise<T>;
  texture?: T;
  users: number;
}

export class ProgressiveTextureCache<T extends DisposableTexture> {
  private readonly cache = new Map<string, CachedTexture<T>>();
  private nextId = 1;
  private readonly loader: (key: string, progress: TextureProgress) => Promise<T>;
  private readonly diagnostic: TextureDiagnostic;

  constructor(
    loader: (key: string, progress: TextureProgress) => Promise<T>,
    diagnostic: TextureDiagnostic = () => undefined,
  ) {
    this.loader = loader;
    this.diagnostic = diagnostic;
  }

  acquire(key: string) {
    let entry = this.cache.get(key);
    if (!entry) {
      const id = this.nextId++;
      this.diagnostic('queued', id);
      const promise = this.loader(key, (event, reason) => this.diagnostic(event, id, reason));
      entry = { id, users: 0, promise };
      const createdEntry = entry;
      promise.then(
        (texture) => {
          createdEntry.texture = texture;
          this.diagnostic('created', createdEntry.id);
          if (createdEntry.users === 0) this.disposeEntry(key, createdEntry);
        },
        (error: unknown) => {
          this.diagnostic('unavailable', createdEntry.id, textureFailureReason(error));
          this.deleteIfCurrent(key, createdEntry);
        },
      );
      this.cache.set(key, entry);
    }

    entry.users++;
    const acquiredEntry = entry;
    let released = false;
    return {
      id: acquiredEntry.id,
      promise: acquiredEntry.promise,
      release: () => {
        if (released) return;
        released = true;
        acquiredEntry.users = Math.max(0, acquiredEntry.users - 1);
        if (acquiredEntry.users === 0 && acquiredEntry.texture) this.disposeEntry(key, acquiredEntry);
      },
    };
  }

  reportApplied(resourceId: number): void {
    this.diagnostic('applied', resourceId);
  }

  private disposeEntry(key: string, entry: CachedTexture<T>): void {
    if (!entry.texture || entry.users !== 0) return;
    entry.texture.dispose();
    entry.texture = undefined;
    this.diagnostic('disposed', entry.id);
    this.deleteIfCurrent(key, entry);
  }

  private deleteIfCurrent(key: string, entry: CachedTexture<T>): void {
    if (this.cache.get(key) === entry) this.cache.delete(key);
  }
}

const queue = new TaskQueue();

class TextureLoadError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}

const textureFailureReason = (error: unknown): string =>
  error instanceof TextureLoadError ? error.reason : 'texture_creation_failed';

const decodeTexture = (url: string, progress: TextureProgress): Promise<THREE.Texture> => queue.run(() => new Promise((resolve, reject) => {
  progress('loading');
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    progress('decoded');
    try {
      const size = fittedTextureSize(image.naturalWidth, image.naturalHeight);
      const canvasSize = Math.max(size.width, size.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new TextureLoadError('canvas_unavailable');
      context.fillStyle = '#f8f5eb';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const frame = calculateContainRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
      context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      resolve(texture);
    } catch (error) { reject(error); }
  };
  image.onerror = () => reject(new TextureLoadError('image_load_or_decode_failed'));
  image.src = url;
}));

let pendingTextures = 0;
const trackedDecodeTexture = async (url: string, progress: TextureProgress): Promise<THREE.Texture> => {
  if (pendingTextures === 0) markStartup('memory_textures_start');
  pendingTextures++;
  try {
    return await decodeTexture(url, progress);
  } finally {
    pendingTextures--;
    if (pendingTextures === 0) {
      markStartup('memory_textures_ready');
      measureStartup('memory-textures-progressive', 'memory_textures_start', 'memory_textures_ready');
    }
  }
};

const textureCache = new ProgressiveTextureCache(trackedDecodeTexture, developmentDiagnostic);

export const acquirePolaroidTexture = (url: string) => textureCache.acquire(url);
export const reportPolaroidTextureApplied = (resourceId: number) => textureCache.reportApplied(resourceId);

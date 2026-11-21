import * as THREE from 'three';
import { markStartup, measureStartup } from './startup.ts';

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

const queue = new TaskQueue();

const decodeTexture = (url: string): Promise<THREE.Texture> => queue.run(() => new Promise((resolve, reject) => {
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    try {
      const size = fittedTextureSize(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('canvas_unavailable');
      context.drawImage(image, 0, 0, size.width, size.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      resolve(texture);
    } catch (error) { reject(error); }
  };
  image.onerror = () => reject(new Error('image_decode_failed'));
  image.src = url;
}));

interface CachedTexture { promise: Promise<THREE.Texture>; texture?: THREE.Texture; users: number }
const cache = new Map<string, CachedTexture>();
let pendingTextures = 0;

export const acquirePolaroidTexture = (url: string) => {
  let entry = cache.get(url);
  if (!entry) {
    if (pendingTextures === 0) markStartup('memory_textures_start');
    pendingTextures++;
    const promise = decodeTexture(url).finally(() => {
      pendingTextures--;
      if (pendingTextures === 0) {
        markStartup('memory_textures_ready');
        measureStartup('memory-textures-progressive', 'memory_textures_start', 'memory_textures_ready');
      }
    });
    entry = { users: 0, promise };
    entry.promise.then((texture) => { if (entry) entry.texture = texture; }).catch(() => cache.delete(url));
    cache.set(url, entry);
  }
  entry.users++;
  let released = false;
  return {
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      entry!.users--;
      if (entry!.users <= 0) entry!.promise.then(() => {
        if (entry!.users <= 0) { entry!.texture?.dispose(); cache.delete(url); }
      }, () => cache.delete(url));
    },
  };
};

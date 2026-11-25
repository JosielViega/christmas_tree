import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_GIFT_PHOTO_MAX_BYTES,
  GIFT_COMPOSITION_MODES,
  GIFT_STYLES,
  GIFT_TEXTURE_SIZE,
  GiftPhotoError,
  calculateCoverCrop,
  createPersonalizedGiftCanvases,
  decodeGiftPhoto,
  detectGiftPhotoMime,
  disposeGiftTextures,
  getGiftPhotoMaxBytes,
  isGiftPreviewEnabled,
  replaceDecodedGiftPhoto,
  selectPersistedGiftCanvas,
  giftCanvasToPng,
  validateGiftPhotoDimensions,
  validateGiftPhotoFile,
} from '../utils/giftTextures.ts';
import type { DecodedGiftPhoto, GiftPhotoDecodeEnvironment } from '../utils/giftTextures.ts';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);

const fakeFile = (bytes: Uint8Array, type: string, size = bytes.byteLength): File => ({
  size,
  type,
  slice: () => new Blob([bytes]),
} as File);

const fakePhoto = (dispose = () => undefined): DecodedGiftPhoto => ({
  source: {} as CanvasImageSource,
  width: 1200,
  height: 800,
  mime: 'image/jpeg',
  dispose,
});

test('real signatures accept JPEG, PNG and WebP only', () => {
  assert.equal(detectGiftPhotoMime(JPEG), 'image/jpeg');
  assert.equal(detectGiftPhotoMime(PNG), 'image/png');
  assert.equal(detectGiftPhotoMime(WEBP), 'image/webp');
  assert.equal(detectGiftPhotoMime(new Uint8Array([1, 2, 3, 4])), null);
});

test('file validation rejects oversize, empty, unsupported and mismatched content', async () => {
  await assert.rejects(validateGiftPhotoFile(fakeFile(JPEG, 'image/jpeg', DEFAULT_GIFT_PHOTO_MAX_BYTES + 1)), /no máximo 8 MB/);
  await assert.rejects(validateGiftPhotoFile(fakeFile(new Uint8Array(), 'image/png', 0)), /vazio/);
  await assert.rejects(validateGiftPhotoFile(fakeFile(new Uint8Array(16), 'image/png')), /JPEG, PNG ou WebP/);
  await assert.rejects(validateGiftPhotoFile(fakeFile(PNG, 'image/jpeg')), /não corresponde/);
});

test('dimension validation rejects implausible and excessive images', () => {
  assert.throws(() => validateGiftPhotoDimensions(0, 500), GiftPhotoError);
  assert.throws(() => validateGiftPhotoDimensions(20_000, 500), GiftPhotoError);
  assert.throws(() => validateGiftPhotoDimensions(10_000, 10_000), GiftPhotoError);
  assert.doesNotThrow(() => validateGiftPhotoDimensions(4_000, 3_000));
});

test('createImageBitmap failure falls back to Image decoding', async () => {
  let bitmapAttempts = 0;
  const revoked: string[] = [];
  const image = { naturalWidth: 1200, naturalHeight: 800, onload: null, onerror: null } as unknown as HTMLImageElement;
  Object.defineProperty(image, 'src', {
    set(value: string) {
      if (value) queueMicrotask(() => image.onload?.(new Event('load')));
    },
  });
  const environment: GiftPhotoDecodeEnvironment = {
    createImageBitmap: (async () => { bitmapAttempts += 1; throw new Error('decoder internals'); }) as typeof createImageBitmap,
    createObjectURL: () => 'blob:fallback-photo',
    revokeObjectURL: (url) => { revoked.push(url); },
    createImage: () => image,
  };
  const decoded = await decodeGiftPhoto(fakeFile(JPEG, 'image/jpeg'), DEFAULT_GIFT_PHOTO_MAX_BYTES, environment);
  assert.equal(bitmapAttempts, 2);
  assert.equal(decoded.source, image);
  assert.deepEqual([decoded.width, decoded.height], [1200, 800]);
  decoded.dispose();
  assert.deepEqual(revoked, ['blob:fallback-photo']);
});

test('bitmap decoder retries without orientation options before using Image fallback', async () => {
  const attempts: Array<ImageBitmapOptions | undefined> = [];
  const bitmap = { width: 800, height: 1200, close: () => undefined } as ImageBitmap;
  const environment: GiftPhotoDecodeEnvironment = {
    createImageBitmap: (async (_file: ImageBitmapSource, options?: ImageBitmapOptions) => {
      attempts.push(options);
      if (options) throw new TypeError('unsupported imageOrientation option');
      return bitmap;
    }) as typeof createImageBitmap,
    createObjectURL: () => { throw new Error('Image fallback must not run after bitmap success.'); },
    revokeObjectURL: () => undefined,
    createImage: () => ({} as HTMLImageElement),
  };

  const decoded = await decodeGiftPhoto(fakeFile(JPEG, 'image/jpeg'), DEFAULT_GIFT_PHOTO_MAX_BYTES, environment);
  assert.equal(decoded.source, bitmap);
  assert.deepEqual(attempts.map((options) => options?.imageOrientation), ['from-image', undefined]);
  decoded.dispose();
});

test('corrupt image failures remain controlled and release fallback resources', async () => {
  const revoked: string[] = [];
  const image = { naturalWidth: 0, naturalHeight: 0, onload: null, onerror: null } as unknown as HTMLImageElement;
  Object.defineProperty(image, 'src', {
    set(value: string) {
      if (value) queueMicrotask(() => image.onerror?.(new Event('error')));
    },
  });
  const environment: GiftPhotoDecodeEnvironment = {
    createImageBitmap: (async () => { throw new Error('decoder internals'); }) as typeof createImageBitmap,
    createObjectURL: () => 'blob:corrupt-photo',
    revokeObjectURL: (url) => { revoked.push(url); },
    createImage: () => image,
  };
  await assert.rejects(decodeGiftPhoto(fakeFile(JPEG, 'image/jpeg'), DEFAULT_GIFT_PHOTO_MAX_BYTES, environment), (error: unknown) => {
    assert.ok(error instanceof GiftPhotoError);
    assert.doesNotMatch(error.message, /decoder internals/);
    assert.match(error.message, /corrompida|n.o p.de ser lida/i);
    return true;
  });
  assert.deepEqual(revoked, ['blob:corrupt-photo']);
});

test('invalid decoded dimensions close the temporary bitmap', async () => {
  let closed = 0;
  const bitmap = { width: 1, height: 1, close: () => { closed += 1; } } as ImageBitmap;
  const environment: GiftPhotoDecodeEnvironment = {
    createImageBitmap: (async () => bitmap) as typeof createImageBitmap,
    createObjectURL: () => '',
    revokeObjectURL: () => undefined,
    createImage: () => ({} as HTMLImageElement),
  };
  await assert.rejects(decodeGiftPhoto(fakeFile(JPEG, 'image/jpeg'), DEFAULT_GIFT_PHOTO_MAX_BYTES, environment), GiftPhotoError);
  assert.equal(closed, 1);
});

test('fallback decoding revokes its Object URL when the preview closes', async () => {
  const revoked: string[] = [];
  const image = { naturalWidth: 800, naturalHeight: 600, onload: null, onerror: null } as unknown as HTMLImageElement;
  Object.defineProperty(image, 'src', {
    set(value: string) {
      if (value) queueMicrotask(() => image.onload?.(new Event('load')));
    },
  });
  const environment: GiftPhotoDecodeEnvironment = {
    createObjectURL: () => 'blob:local-preview',
    revokeObjectURL: (url) => { revoked.push(url); },
    createImage: () => image,
  };
  const decoded = await decodeGiftPhoto(fakeFile(PNG, 'image/png'), DEFAULT_GIFT_PHOTO_MAX_BYTES, environment);
  assert.deepEqual(revoked, []);
  decoded.dispose();
  assert.deepEqual(revoked, ['blob:local-preview']);
});

test('cover crop preserves aspect ratio without stretching', () => {
  assert.deepEqual(calculateCoverCrop(1200, 800, 100, 100), { sx: 200, sy: 0, sw: 800, sh: 800 });
  assert.deepEqual(calculateCoverCrop(800, 1200, 100, 100), { sx: 0, sy: 200, sw: 800, sh: 800 });
  assert.deepEqual(calculateCoverCrop(1200, 800, 100, 100, 0, 0.5), { sx: 0, sy: 0, sw: 800, sh: 800 });
  assert.deepEqual(calculateCoverCrop(1200, 800, 100, 100, 1, 0.5), { sx: 400, sy: 0, sw: 800, sh: 800 });
  assert.deepEqual(calculateCoverCrop(800, 1200, 100, 100, 0.5, 1), { sx: 0, sy: 400, sw: 800, sh: 800 });
  assert.deepEqual(calculateCoverCrop(1200, 800, 100, 100, 0.5, 0.5, 2), { sx: 400, sy: 200, sw: 400, sh: 400 });
  assert.deepEqual(calculateCoverCrop(1200, 800, 100, 100, 1, 1, 3), {
    sx: 1200 - (800 / 3), sy: 800 - (800 / 3), sw: 800 / 3, sh: 800 / 3,
  });
});

test('three styles and two composition modes remain available', () => {
  assert.deepEqual(GIFT_STYLES.map((style) => style.id), ['classic', 'magic', 'romantic']);
  assert.deepEqual(GIFT_COMPOSITION_MODES.map((mode) => mode.id), ['repeated', 'featured']);
  assert.equal(GIFT_TEXTURE_SIZE, 512);
});

test('wrapping generation fills the entire paper in repeated and featured modes', () => {
  let drawCalls = 0;
  const context = new Proxy({
    drawImage: () => { drawCalls += 1; },
  } as unknown as CanvasRenderingContext2D, {
    get(target, property) {
      const value = Reflect.get(target, property);
      return value ?? (() => undefined);
    },
    set(target, property, value) {
      Reflect.set(target, property, value);
      return true;
    },
  });
  const createCanvas = () => ({ width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement);

  const repeated = createPersonalizedGiftCanvases(fakePhoto(), 'classic', 'repeated', createCanvas);
  assert.equal(repeated.paper.width, 512);
  assert.equal(repeated.front, null);
  assert.equal(drawCalls, 16);

  drawCalls = 0;
  const featured = createPersonalizedGiftCanvases(fakePhoto(), 'magic', 'featured', createCanvas);
  assert.equal(featured.paper.width, 512);
  assert.equal(featured.front?.height, 512);
  assert.equal(drawCalls, 1);
  assert.equal(featured.paper, featured.front);
});

test('missing Canvas 2D support produces a controlled error', () => {
  const createCanvas = () => ({ width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement);
  assert.throws(() => createPersonalizedGiftCanvases(fakePhoto(), 'classic', 'repeated', createCanvas), GiftPhotoError);
});

test('texture and photograph replacement dispose previous resources', () => {
  let textureDisposals = 0;
  disposeGiftTextures([{ dispose: () => { textureDisposals += 1; } }, { dispose: () => { textureDisposals += 1; } }]);
  assert.equal(textureDisposals, 2);

  let photoDisposals = 0;
  const previous = fakePhoto(() => { photoDisposals += 1; });
  const next = fakePhoto();
  assert.equal(replaceDecodedGiftPhoto(previous, next), next);
  assert.equal(photoDisposals, 1);
  assert.equal(replaceDecodedGiftPhoto(next, next), next);
});

test('production access is disabled unless explicitly configured', () => {
  assert.equal(isGiftPreviewEnabled(true, undefined), true);
  assert.equal(isGiftPreviewEnabled(false, undefined), false);
  assert.equal(isGiftPreviewEnabled(false, 'false'), false);
  assert.equal(isGiftPreviewEnabled(false, 'true'), true);
  assert.equal(getGiftPhotoMaxBytes(undefined), 8 * 1024 * 1024);
  assert.equal(getGiftPhotoMaxBytes(String(64 * 1024 * 1024)), 32 * 1024 * 1024);
});

test('texture generation remains local and contains no network or payment code', () => {
  const modal = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  const textures = readFileSync(new URL('../utils/giftTextures.ts', import.meta.url), 'utf8');
  const source = textures;
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|\/api\//);
  assert.doesNotMatch(source, /localStorage|indexedDB|sessionStorage/);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /checkout|pagamento|comprar|pedido concluído/i);
});

test('draft preparation uploads only the final texture and payment remains same-origin', () => {
  const modal = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  const textures = readFileSync(new URL('../utils/giftTextures.ts', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/giftDrafts.ts', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../api/giftPayments.ts', import.meta.url), 'utf8');
  assert.match(api, /FormData/);
  assert.match(api, /body\.set\('texture'/);
  assert.doesNotMatch(api, /original_photo|source_photo/);
  assert.doesNotMatch(`${modal}\n${textures}\n${api}\n${payments}`, /https?:\/\//);
  assert.match(payments, /\/api\/gift-drafts\/\$\{encodeURIComponent\(giftPublicId\)\}\/order/);
  assert.match(payments, /X-Gift-Draft-Token/);
  assert.match(payments, /X-CSRF-Token/);
  assert.doesNotMatch(payments, /amount_cents.*body|price.*body/i);
  assert.match(modal, /ainda n.o foi publicado/i);
  assert.match(modal, /consent/i);
});

test('Pix checkout never accepts paid state or publishes from the browser', () => {
  const modal = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  const payments = readFileSync(new URL('../api/giftPayments.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(payments, /body\.(?:set|append)\(['"](?:status|paid|published)/i);
  assert.doesNotMatch(payments, /method:\s*['"](?:PATCH|PUT)['"]/i);
  assert.match(modal, /confirma..o ocorre de forma segura pelo provedor/i);
  assert.match(modal, /somente o backend pode publicar/i);
  assert.match(payments, /cache: 'no-store'/);
});

test('checkout presents distinct localized financial and publication states', () => {
  const modal = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  assert.match(modal, /Pagamento aguardando Pix/);
  assert.match(modal, /Pagamento aprovado/);
  assert.match(modal, /Pagamento expirado/);
  assert.match(modal, /Pagamento cancelado/);
  assert.match(modal, /Pagamento recusado/);
  assert.match(modal, /Pagamento reembolsado/);
  assert.match(modal, /Pagamento confirmado\. Estamos preparando seu presente/);
  assert.match(modal, /Seu presente foi enviado/);
  assert.match(modal, /reembolsado e o presente não está mais visível/);
  assert.match(modal, /aria-live="polite"/);
});

test('persistence selects one final 512 texture and encodes PNG only', async () => {
  const paper = { width: 512, height: 512 } as HTMLCanvasElement;
  const front = { width: 512, height: 512 } as HTMLCanvasElement;
  assert.equal(selectPersistedGiftCanvas({ paper, front: null }, 'repeated'), paper);
  assert.equal(selectPersistedGiftCanvas({ paper, front }, 'featured'), front);
  const png = new Blob([PNG], { type: 'image/png' });
  const canvas = { toBlob: (callback: BlobCallback, type?: string) => {
    assert.equal(type, 'image/png');
    callback(png);
  } } as HTMLCanvasElement;
  assert.equal(await giftCanvasToPng(canvas), png);
});

test('style changes reuse the already decoded photo in the preview component', () => {
  const source = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/decodeGiftPhoto\(/g) ?? []).length, 1);
  assert.match(source, /createPersonalizedGiftCanvases\(photo, style, mode/);
  assert.match(source, /Enquadramento da foto/);
  assert.match(source, /Zoom · \{cropZoom\.toFixed\(1\)\}×/);
});

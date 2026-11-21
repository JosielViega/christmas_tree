import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canAdvanceStartup, getInitialDpr, getInitialTreeParticleCount, isStartupBlocking, startupMessage } from '../utils/startup.ts';
import { estimatedRgbaBytes, fittedTextureSize, POLAROID_TEXTURE_CONCURRENCY, TaskQueue } from '../utils/progressiveTextures.ts';

test('startup state machine advances without regressing and exposes an error recovery state', () => {
  assert.equal(canAdvanceStartup('initializing', 'loading_data'), true);
  assert.equal(canAdvanceStartup('first_frame', 'preparing_scene'), false);
  assert.equal(canAdvanceStartup('ready', 'error'), false);
  assert.equal(canAdvanceStartup('error', 'initializing'), true);
  assert.equal(isStartupBlocking('error'), true);
  assert.equal(isStartupBlocking('ready'), false);
  assert.equal(startupMessage('first_frame'), 'Acendendo as luzes...');
});

test('modest devices start with a conservative DPR while capable devices remain bounded', () => {
  assert.deepEqual(getInitialDpr({ hardwareConcurrency: 4, deviceMemory: 4, devicePixelRatio: 3 }), [1, 1.25]);
  assert.deepEqual(getInitialDpr({ hardwareConcurrency: 8, deviceMemory: 8, devicePixelRatio: 3 }), [1, 1.75]);
  assert.equal(getInitialTreeParticleCount({ hardwareConcurrency: 4, deviceMemory: 4 }, 20_000), 12_000);
  assert.equal(getInitialTreeParticleCount({ hardwareConcurrency: 8, deviceMemory: 8 }, 20_000), 20_000);
});

test('progressive texture queue never exceeds two simultaneous image decodes', async () => {
  const queue = new TaskQueue(POLAROID_TEXTURE_CONCURRENCY);
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 6 }, () => queue.run(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
  }));
  await Promise.all(tasks);
  assert.equal(peak, 2);
});

test('distance textures cap six 1024px photos at one quarter of the base RGBA allocation', () => {
  const target = fittedTextureSize(1024, 1024);
  assert.deepEqual(target, { width: 512, height: 512 });
  for (const count of [0, 1, 3, 6]) {
    const original = estimatedRgbaBytes(1024, 1024) * count;
    const progressive = estimatedRgbaBytes(target.width, target.height) * count;
    assert.equal(progressive, original / 4);
  }
});

test('Polaroids are progressive fallbacks and no longer suspend the basic scene', () => {
  const polaroid = readFileSync(new URL('../components/Polaroid.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
  const ornament = readFileSync(new URL('../components/SocialOrnament.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(polaroid, /useTexture|Suspense/);
  assert.match(polaroid, /textureFailed/);
  assert.match(scene, /frames\.current === 2/);
  assert.match(scene, /webglcontextlost/);
  assert.doesNotMatch(ornament, /scale\.lerp\(new THREE\.Vector3/);
});

test('secondary requests are abortable and do not define essential readiness', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/trees.ts', import.meta.url), 'utf8');
  assert.match(app, /essentialReady=\{Boolean\(tree && ornamentsReady\)\}/);
  assert.match(app, /controller\.abort\(\)/);
  assert.match(api, /signal\?: AbortSignal/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
const ambient = readFileSync(new URL('../components/AmbientNight.tsx', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../components/Overlay.tsx', import.meta.url), 'utf8');
const giftModal = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');

test('capture exposure is temporary and renderer state is restored', () => {
  assert.match(scene, /toneMappingExposure: gl\.toneMappingExposure/);
  assert.match(scene, /gl\.toneMappingExposure = saved\.toneMappingExposure/);
  assert.match(scene, /prepare\(options\.width, options\.height, 1\.22\)/);
});

test('ambient diagnostics are development-only and do not alter normal schedules', () => {
  assert.match(overlay, /import\.meta\.env\.DEV/);
  assert.match(ambient, /import\.meta\.env\.DEV/);
  assert.match(ambient, /SANTA_SCHEDULE/);
  assert.match(ambient, /SHOOTING_STAR_SCHEDULE/);
});

test('unavailable payments are explained without simulating publication', () => {
  assert.match(giftModal, /Nenhuma cobrança ou publicação será criada/);
  assert.match(giftModal, /paymentAvailable/);
  assert.doesNotMatch(giftModal, /setOrder\([^)]*paid/);
});

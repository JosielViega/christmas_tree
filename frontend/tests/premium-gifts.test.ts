import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPremiumGiftTransform, PREMIUM_GIFT_FOCUS_DISTANCE, PREMIUM_GIFT_SCALE, PREMIUM_GIFT_VISIBLE_LIMIT } from '../utils/premiumGiftLayout.ts';

test('premium gift layout is deterministic and keeps the first visible page separated', () => {
  const first = getPremiumGiftTransform(0);
  assert.deepEqual(first, getPremiumGiftTransform(0));
  const positions = Array.from({ length: PREMIUM_GIFT_VISIBLE_LIMIT }, (_, index) => getPremiumGiftTransform(index).position);
  assert.equal(new Set(positions.map(([x, , z]) => `${x.toFixed(4)}:${z.toFixed(4)}`)).size, PREMIUM_GIFT_VISIBLE_LIMIT);
});

test('premium gift layout rejects invalid indices and versions', () => {
  assert.throws(() => getPremiumGiftTransform(-1));
  assert.throws(() => getPremiumGiftTransform(0, 3));
});

test('premium gifts gain visual presence without changing legacy layout data', () => {
  assert.equal(PREMIUM_GIFT_SCALE, 1.2);
  assert.ok(PREMIUM_GIFT_SCALE >= 0.92 * 1.25);
  assert.ok(PREMIUM_GIFT_SCALE <= 0.92 * 1.35);
});

test('published gift focus leaves room for the whole box, bow and message card', () => {
  assert.equal(PREMIUM_GIFT_FOCUS_DISTANCE, 7.2);
  assert.ok(PREMIUM_GIFT_FOCUS_DISTANCE > 6);
});

test('automatic baubles are restrained and remain separate from persisted ornaments', () => {
  const spiral = readFileSync(new URL('../components/SpiralDecor.tsx', import.meta.url), 'utf8');
  assert.match(spiral, /AUTOMATIC_BAUBLE_COUNT = 32/);
  assert.match(spiral, /reducedMotion/);
  assert.doesNotMatch(spiral, /const count = 100/);
});

test('free decoration UI excludes present while the legacy renderer remains', () => {
  const modal = readFileSync(new URL('../components/OrnamentDecorationModal.tsx', import.meta.url), 'utf8');
  const legacyRenderer = readFileSync(new URL('../components/SocialOrnament.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(modal, /type:\s*['"]present['"]/);
  assert.match(legacyRenderer, /present:/);
});

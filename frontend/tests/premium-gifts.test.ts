import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPremiumGiftTransform, PREMIUM_GIFT_VISIBLE_LIMIT } from '../utils/premiumGiftLayout.ts';

test('premium gift layout is deterministic and keeps the first visible page separated', () => {
  const first = getPremiumGiftTransform(0);
  assert.deepEqual(first, getPremiumGiftTransform(0));
  const positions = Array.from({ length: PREMIUM_GIFT_VISIBLE_LIMIT }, (_, index) => getPremiumGiftTransform(index).position);
  assert.equal(new Set(positions.map(([x, , z]) => `${x.toFixed(4)}:${z.toFixed(4)}`)).size, PREMIUM_GIFT_VISIBLE_LIMIT);
});

test('premium gift layout rejects invalid indices and versions', () => {
  assert.throws(() => getPremiumGiftTransform(-1));
  assert.throws(() => getPremiumGiftTransform(0, 2 as 1));
});

test('free decoration UI excludes present while the legacy renderer remains', () => {
  const modal = readFileSync(new URL('../components/OrnamentDecorationModal.tsx', import.meta.url), 'utf8');
  const legacyRenderer = readFileSync(new URL('../components/SocialOrnament.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(modal, /type:\s*['"]present['"]/);
  assert.match(legacyRenderer, /present:/);
});

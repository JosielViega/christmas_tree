import assert from 'node:assert/strict';
import test from 'node:test';
import { DECORATIVE_GIFT_COUNT, getDecorativeGiftTransforms, horizontalGiftDistance } from '../utils/decorativeGiftLayout.ts';
import { getPremiumGiftTransform } from '../utils/premiumGiftLayout.ts';

test('decorative gifts are reduced, deterministic and do not collide with each other', () => {
  const gifts = getDecorativeGiftTransforms();
  assert.equal(gifts.length, DECORATIVE_GIFT_COUNT);
  assert.equal(DECORATIVE_GIFT_COUNT, 12);
  assert.deepEqual(gifts, getDecorativeGiftTransforms());
  gifts.forEach((gift, index) => gifts.slice(index + 1).forEach((other) => {
    assert.ok(horizontalGiftDistance(gift.position, other.position) > 1.4);
  }));
});

test('layout v1 remains stable while new premium gifts use the safer outer ring', () => {
  assert.deepEqual(getPremiumGiftTransform(0, 1).position, [0, -6.82, 4.9]);
  assert.deepEqual(getPremiumGiftTransform(0, 2).position, [0, -6.82, 6.8]);
  assert.ok(horizontalGiftDistance(getPremiumGiftTransform(0, 1).position, getPremiumGiftTransform(0, 2).position) > 1.5);
});

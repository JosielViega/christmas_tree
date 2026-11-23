import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../api/trees.ts', import.meta.url), 'utf8');

test('premium messages are requested only through the private owner endpoint', () => {
  assert.match(api, /fetchPremiumGiftMessage/);
  assert.match(api, /\/gifts\/\$\{encodeURIComponent\(giftPublicId\)\}\/message/);
  assert.match(api, /cache: 'no-store'/);
  assert.match(app, /tree && isOwner && gift\.has_message/);
  assert.match(app, /caught\.code === 'gift_message_locked'/);
});

test('returning to the page revalidates released and re-locked messages', () => {
  assert.match(app, /visibilitychange/);
  assert.match(app, /loadOwnerMessages\(tree\.public_id, true\)/);
  assert.match(app, /loadPremiumGiftMessage\(tree\.public_id, selectedGift\.public_id\)/);
  assert.match(app, /requestSequence !== giftMessageRequestSequence\.current/);
  assert.match(app, /setOwnerMessages\(\{\}\)/);
});

test('public gift collections still contain no private message field', () => {
  const types = readFileSync(new URL('../types.ts', import.meta.url), 'utf8');
  const premiumGift = types.slice(types.indexOf('export interface PremiumGiftData'), types.indexOf('export interface PremiumGiftCollection'));
  assert.doesNotMatch(premiumGift, /\bmessage\s*:/);
});

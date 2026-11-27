import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('owner sees sharing guidance instead of the premium gift purchase action', () => {
  assert.match(app, /Esta é sua árvore! 🎄 Compartilhe com seus amigos para receber presentes especiais\./);
  assert.match(app, /isOwner \? \(/);
  assert.match(app, /\) : giftPreviewEnabled \? \(/);
});

test('owner state closes and cannot mount the premium gift wizard', () => {
  assert.match(app, /if \(isOwner\) setGiftPreviewOpen\(false\)/);
  assert.match(app, /giftPreviewEnabled && !isOwner && giftPreviewOpen/);
});

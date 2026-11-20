import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../components/Overlay.tsx', import.meta.url), 'utf8');

test('social overlay is mobile-first and omits demonstration controls', () => {
  assert.match(overlay, /safe-area-inset-top/);
  assert.match(app, /safe-area-inset-bottom/);
  for (const obsolete of ['Cinematic Tour', 'Add Photos', 'Hand Controls', 'Gesture Mode']) {
    assert.doesNotMatch(overlay, new RegExp(obsolete));
  }
});

test('owner invites friends while a visitor gets decoration and own-tree actions', () => {
  assert.match(app, /Convide seus amigos para decorar!/);
  assert.match(app, /Decorar árvore/);
  assert.match(app, /Minha árvore/);
  assert.match(app, /Criar minha árvore/);
});

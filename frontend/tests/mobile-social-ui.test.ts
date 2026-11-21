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

test('owner shares while a visitor gets decoration, premium and own-tree actions', () => {
  assert.match(app, /Compartilhar árvore/);
  assert.match(app, /Decorar árvore/);
  assert.match(app, /Enviar presente especial/);
  assert.match(app, /Minha árvore/);
  assert.match(app, /Criar minha árvore/);
});

test('mobile controls use safe areas, horizontal actions and compact expandable indicators', () => {
  const indicator = readFileSync(new URL('../components/TreeProgressIndicator.tsx', import.meta.url), 'utf8');
  assert.match(app, /overflow-x-auto/);
  assert.match(app, /safe-area-inset-bottom/);
  assert.match(indicator, /<details/);
  assert.match(indicator, /messageOverview/);
  assert.doesNotMatch(app, /top-\[max\(14rem/);
});

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
  assert.match(app, /Presente especial/);
  assert.match(app, /Minha árvore/);
  assert.match(app, /Criar minha árvore/);
});

test('mobile controls use safe areas, a two-row grid and compact expandable indicators', () => {
  const indicator = readFileSync(new URL('../components/TreeProgressIndicator.tsx', import.meta.url), 'utf8');
  assert.match(app, /grid-cols-2/);
  assert.match(app, /col-span-2/);
  assert.doesNotMatch(app, /overflow-x-auto/);
  assert.match(app, /safe-area-inset-bottom/);
  assert.match(indicator, /<details/);
  assert.match(indicator, /messageOverview/);
  assert.doesNotMatch(app, /top-\[max\(14rem/);
});

test('disabled premium experience is visible before interaction and does not open a modal', () => {
  assert.match(app, /disabled aria-disabled="true"/);
  assert.match(app, /Presentes · Em breve/);
  assert.match(app, /giftPreviewEnabled \? \(/);
});

test('toast stays above bottom actions, is dismissible and yields to modal layers', () => {
  assert.match(app, /top-\[max\(9rem/);
  assert.match(app, /pointer-events-none fixed/);
  assert.match(app, /!ornamentModalOpen && !shareModalOpen && !memoriesPanelOpen && !giftPreviewOpen/);
  assert.match(app, /aria-label="Fechar aviso"/);
});

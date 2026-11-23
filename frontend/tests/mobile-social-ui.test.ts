import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../components/Overlay.tsx', import.meta.url), 'utf8');
const indicator = readFileSync(new URL('../components/TreeProgressIndicator.tsx', import.meta.url), 'utf8');

test('social overlay is mobile-first and omits demonstration controls', () => {
  assert.match(overlay, /safe-area-inset-top/);
  assert.match(app, /safe-area-inset-bottom/);
  for (const obsolete of ['Cinematic Tour', 'Add Photos', 'Hand Controls', 'Gesture Mode']) {
    assert.doesNotMatch(overlay, new RegExp(obsolete));
  }
});

test('owner shares while a visitor gets decoration, premium and own-tree actions', () => {
  assert.match(app, /Compartilhar árvore/);
  assert.match(app, /Decorar esta árvore/);
  assert.match(app, /Presente especial/);
  assert.match(app, /Minha árvore/);
  assert.match(app, /Criar minha árvore/);
});

test('free decoration follows the backend visitor participation state', () => {
  assert.match(app, /collection\.current_visitor_has_decorated/);
  assert.match(app, /visitor_already_decorated/);
  assert.match(app, /Você já decorou esta árvore!/);
  assert.match(app, /Agora é só esperar o Natal/);
});

test('mobile controls use safe areas, a two-row grid and compact expandable indicators', () => {
  assert.match(app, /grid-cols-2/);
  assert.match(app, /col-span-2/);
  assert.doesNotMatch(app, /overflow-x-auto/);
  assert.match(app, /safe-area-inset-bottom/);
  assert.match(indicator, /<details/);
  assert.match(indicator, /messageOverview/);
  assert.doesNotMatch(app, /top-\[max\(14rem/);
});

test('mobile header allows long names to wrap within bounded responsive typography', () => {
  assert.doesNotMatch(overlay, /<h1 className="truncate/);
  assert.match(overlay, /max-h-\[2em\]/);
  assert.match(overlay, /break-words/);
  assert.match(overlay, /text-\[clamp\(1\.35rem,6\.5vw,3rem\)\]/);
});

test('options menu closes outside or with Escape and temporarily collapses progression', () => {
  assert.match(overlay, /document\.addEventListener\('pointerdown', closeOutside\)/);
  assert.match(overlay, /event\.key === 'Escape'/);
  assert.match(overlay, /aria-controls="tree-options-menu"/);
  assert.match(overlay, /aria-haspopup="menu"/);
  assert.match(overlay, /role="menu"/);
  assert.match(app, /temporarilyHidden=\{optionsOpen\}/);
  assert.match(indicator, /if \(temporarilyHidden\) return null/);
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

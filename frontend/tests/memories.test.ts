import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('memory layout contains six deterministic positions away from tree extremes', () => {
  const source = readFileSync(new URL('../utils/math.ts', import.meta.url), 'utf8');
  assert.match(source, /generatePhotoPositions\(6\)/);
  assert.match(source, /slotIndex >= 6/);
  assert.match(source, /layoutVersion !== 1/);
  assert.match(source, /startT = 0\.14/);
  assert.match(source, /endT = 0\.79/);
});

test('new trees render no demonstration polaroids and owner panel exposes privacy copy', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../components/MemoriesPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /DEFAULT_PHOTOS_COUNT|PLACEHOLDER_TYPES/);
  assert.match(app, /fetchMemories/);
  assert.match(panel, /Memórias de 2026/);
  assert.match(panel, /ficará visível para quem acessar sua árvore/);
  assert.match(panel, /de 6<\/strong> memórias/);
});

test('memory processing reuses validated decode and emits bounded JPEG', () => {
  const source = readFileSync(new URL('../utils/memoryImages.ts', import.meta.url), 'utf8');
  assert.match(source, /decodeGiftPhoto/);
  assert.match(source, /1024/);
  assert.match(source, /image\/jpeg/);
  assert.doesNotMatch(source, /fetch\(|localStorage|analytics/);
});

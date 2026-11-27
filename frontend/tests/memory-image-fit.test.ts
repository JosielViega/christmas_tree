import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateContainRect } from '../utils/imageFit.ts';

const assertContained = (sourceWidth: number, sourceHeight: number) => {
  const rect = calculateContainRect(sourceWidth, sourceHeight, 512, 512);
  assert.ok(rect.x >= 0 && rect.y >= 0);
  assert.ok(rect.x + rect.width <= 512 + Number.EPSILON);
  assert.ok(rect.y + rect.height <= 512 + Number.EPSILON);
  assert.ok(Math.abs(rect.width / rect.height - sourceWidth / sourceHeight) < 1e-10);
  return rect;
};

test('contain framing preserves complete horizontal, vertical, square and 4:3 photographs', () => {
  assert.deepEqual(assertContained(1600, 900), { x: 0, y: 112, width: 512, height: 288 });
  assert.deepEqual(assertContained(900, 1600), { x: 112, y: 0, width: 288, height: 512 });
  assert.deepEqual(assertContained(1000, 1000), { x: 0, y: 0, width: 512, height: 512 });
  assert.deepEqual(assertContained(1200, 900), { x: 0, y: 64, width: 512, height: 384 });
});

test('edge content is padded rather than cropped in upload and display pipelines', () => {
  const upload = readFileSync(new URL('../utils/memoryImages.ts', import.meta.url), 'utf8');
  const display = readFileSync(new URL('../utils/progressiveTextures.ts', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../components/MemoriesPanel.tsx', import.meta.url), 'utf8');
  assert.match(upload, /calculateContainRect/);
  assert.doesNotMatch(upload, /calculateCoverCrop/);
  assert.match(display, /calculateContainRect/);
  assert.match(display, /fillStyle = '#f8f5eb'/);
  assert.match(display, /canvas\.width = canvasSize/);
  assert.match(display, /canvas\.height = canvasSize/);
  assert.match(panel, /object-contain/);
  assert.doesNotMatch(panel, /object-cover/);
});

test('invalid dimensions fail before producing a misleading crop', () => {
  assert.throws(() => calculateContainRect(0, 900, 512, 512), RangeError);
  assert.throws(() => calculateContainRect(900, Number.NaN, 512, 512), RangeError);
});

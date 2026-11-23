import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { SocialOrnamentData } from '../types.ts';
import {
  getOrnamentNavigation,
  isEditableNavigationTarget,
  orderExistingOrnaments,
} from '../utils/ornamentNavigation.ts';

const ornament = (slot: number, publicId = `ornament-${slot}`): SocialOrnamentData => ({
  public_id: publicId,
  ornament_type: 'heart',
  ornament_color: '#e94b68',
  sender_name: `Pessoa ${slot}`,
  slot_index: slot,
  layout_version: 1,
  created_at: '2026-11-23T00:00:00Z',
  has_message: true,
});

test('empty and missing selections expose no ornament navigation', () => {
  assert.equal(getOrnamentNavigation([], null), null);
  assert.equal(getOrnamentNavigation([ornament(2)], 'missing'), null);
});

test('one ornament remains selected without inventing empty positions', () => {
  const only = ornament(27);
  const navigation = getOrnamentNavigation(orderExistingOrnaments([only]), only.public_id);
  assert.equal(navigation?.total, 1);
  assert.equal(navigation?.index, 0);
  assert.equal(navigation?.previous.public_id, only.public_id);
  assert.equal(navigation?.next.public_id, only.public_id);
});

test('two ornaments navigate in both directions and wrap circularly', () => {
  const ordered = orderExistingOrnaments([ornament(8), ornament(2)]);
  const first = getOrnamentNavigation(ordered, 'ornament-2');
  const last = getOrnamentNavigation(ordered, 'ornament-8');
  assert.equal(first?.next.public_id, 'ornament-8');
  assert.equal(first?.previous.public_id, 'ornament-8');
  assert.equal(last?.next.public_id, 'ornament-2');
  assert.equal(last?.previous.public_id, 'ornament-2');
});

test('ten and sixty ornaments use slot order regardless of request order', () => {
  for (const count of [10, 60]) {
    const reversed = Array.from({ length: count }, (_, index) => ornament(count - index - 1));
    const ordered = orderExistingOrnaments(reversed);
    assert.deepEqual(ordered.map((item) => item.slot_index), Array.from({ length: count }, (_, index) => index));
    const middle = getOrnamentNavigation(ordered, `ornament-${Math.floor(count / 2)}`);
    assert.equal(middle?.total, count);
    assert.equal(middle?.index, Math.floor(count / 2));
  }
});

test('stable public id breaks slot ties without mutating the API collection', () => {
  const received = [ornament(8, 'z-id'), ornament(2), ornament(8, 'a-id')];
  const ordered = orderExistingOrnaments(received);
  assert.deepEqual(ordered.map((item) => item.public_id), ['ornament-2', 'a-id', 'z-id']);
  assert.deepEqual(received.map((item) => item.public_id), ['z-id', 'ornament-2', 'a-id']);
});

test('dynamic removal recalculates totals by stable id and drops a removed selection', () => {
  const initial = orderExistingOrnaments([ornament(2), ornament(8), ornament(15), ornament(27)]);
  const selected = getOrnamentNavigation(initial, 'ornament-15');
  assert.equal(selected?.index, 2);
  assert.equal(selected?.total, 4);

  const otherRemoved = initial.filter((item) => item.public_id !== 'ornament-8');
  const recalculated = getOrnamentNavigation(otherRemoved, 'ornament-15');
  assert.equal(recalculated?.index, 1);
  assert.equal(recalculated?.total, 3);

  const selectedRemoved = otherRemoved.filter((item) => item.public_id !== 'ornament-15');
  assert.equal(getOrnamentNavigation(selectedRemoved, 'ornament-15'), null);
});

test('editable controls are not keyboard navigation targets', () => {
  assert.equal(isEditableNavigationTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
  assert.equal(isEditableNavigationTarget({ tagName: 'textarea' } as unknown as EventTarget), true);
  assert.equal(isEditableNavigationTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
  assert.equal(isEditableNavigationTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget), true);
  assert.equal(isEditableNavigationTarget({ tagName: 'BUTTON' } as unknown as EventTarget), false);
});

test('app reuses focusedPhoto camera flow and isolates ornament keyboard navigation', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const interaction = readFileSync(new URL('../hooks/useTreeInteraction.ts', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');

  assert.match(app, /focusOrnament\(direction === 'next'/);
  assert.match(app, /id: `ornament-\$\{ornament\.public_id\}`/);
  assert.match(app, /setZoomLevel\(ZoomLevel\.ZOOMED_IN\)/);
  assert.match(app, /keyboardNavigationEnabled: !selectedOrnament && !selectedGift/);
  assert.match(app, /event\.key === 'ArrowRight'/);
  assert.match(app, /event\.key === 'ArrowLeft'/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(interaction, /!keyboardNavigationEnabled/);
  assert.match(scene, /angleDiff > Math\.PI/);
  assert.match(scene, /const lerpSpeed = reducedMotion \? 1/);
  assert.doesNotMatch(app, /new Canvas/);
});

test('mobile card keeps a scrollable message area and a stable touch navigation footer', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /aria-label="Navegação entre enfeites"/);
  assert.match(app, /ornamentNavigation\.index \+ 1/);
  assert.match(app, /ornamentNavigation\.total > 1/);
  assert.match(app, /min-h-0 overflow-y-auto/);
  assert.match(app, /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(app, /min-h-11/);
  assert.match(app, /ownerMessages\[selectedOrnament\.public_id\]/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GIFT_WIZARD_STEPS,
  canAdvanceGiftWizard,
  getGiftPreviewMode,
  nextGiftWizardStep,
  previousGiftWizardStep,
} from '../utils/giftWizard.ts';

const complete = {
  productSelected: true,
  photoSelected: true,
  senderName: 'Visitante',
  message: 'Feliz Natal!',
  consent: true,
};

test('guided premium flow exposes the six required stages', () => {
  assert.deepEqual(GIFT_WIZARD_STEPS.map(({ label }) => label), [
    'Escolha', 'Personalize', 'Mensagem', 'Confira', 'Pix', 'Confirmação',
  ]);
});

test('each editable stage validates only its contextual decision', () => {
  assert.equal(canAdvanceGiftWizard(1, { ...complete, productSelected: false }), false);
  assert.equal(canAdvanceGiftWizard(2, { ...complete, photoSelected: false }), false);
  assert.equal(canAdvanceGiftWizard(3, { ...complete, senderName: 'x' }), false);
  assert.equal(canAdvanceGiftWizard(3, { ...complete, message: 'x' }), false);
  assert.equal(canAdvanceGiftWizard(3, { ...complete, consent: false }), false);
  assert.equal(canAdvanceGiftWizard(3, complete), true);
});

test('navigation preserves review as the last stage before draft creation', () => {
  assert.equal(nextGiftWizardStep(1, complete), 2);
  assert.equal(nextGiftWizardStep(2, complete), 3);
  assert.equal(nextGiftWizardStep(3, complete), 4);
  assert.equal(nextGiftWizardStep(4, complete), 4);
  assert.equal(previousGiftWizardStep(4), 3);
  assert.equal(previousGiftWizardStep(5), 5);
});

test('mobile preview is contextual while desktop keeps the two-column preview', () => {
  for (const step of [1, 2, 3, 4, 5, 6] as const) assert.equal(getGiftPreviewMode(step, false), 'full');
  assert.equal(getGiftPreviewMode(1, true), 'hidden');
  assert.equal(getGiftPreviewMode(2, true), 'full');
  assert.equal(getGiftPreviewMode(3, true), 'hidden');
  assert.equal(getGiftPreviewMode(3, true, true), 'full');
  assert.equal(getGiftPreviewMode(4, true), 'compact');
  assert.equal(getGiftPreviewMode(4, true, true), 'full');
  assert.equal(getGiftPreviewMode(5, true), 'hidden');
  assert.equal(getGiftPreviewMode(6, true), 'hidden');
});

test('modal mounts WebGL only for a visible useful preview and keeps navigation reachable', () => {
  const source = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /previewMode !== 'hidden' && <section/);
  assert.match(source, /data-preview-mode=\{previewMode\}/);
  assert.match(source, /sticky bottom-0/);
  assert.match(source, /contentRef\.current\.scrollTop = 0/);
  assert.match(source, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(source, /h-\[calc\(100dvh-env\(safe-area-inset-top\)-env\(safe-area-inset-bottom\)\)\]/);
});

test('step changes preserve form data and reuse the prepared preview texture', () => {
  const source = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  const transitionEffect = source.match(/useEffect\(\(\) => \{\s*setPreviewExpanded\(false\);[\s\S]*?\}, \[step\]\);/)?.[0] ?? '';
  assert.doesNotMatch(transitionEffect, /set(?:Photo|Style|Mode|Crop|SenderName|Message|Consent|PayerEmail)/);
  assert.match(source, /const previewTexture = useMemo/);
  assert.match(source, /<PersonalizedGift texture=\{previewTexture\}/);
  assert.doesNotMatch(source.match(/const PersonalizedGift[\s\S]*?\n\);/)?.[0] ?? '', /createCanvasTexture/);
});

test('payment and publication remain backend-controlled in the guided modal', () => {
  const source = readFileSync(new URL('../components/GiftPreviewModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /setStep\(5\)/);
  assert.match(source, /publication_status === 'published'/);
  assert.match(source, /setStep\(6\)/);
  assert.doesNotMatch(source, /setOrder\([^\n]*(?:paid|published)/i);
  assert.match(source, /prefers-reduced-motion/);
});

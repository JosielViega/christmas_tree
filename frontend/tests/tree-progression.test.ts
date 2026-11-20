import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TREE_PROGRESSION_STAGES,
  getTreeProgression,
  getTreeProgressionFromOrnaments,
  getUnlockedProgressionStage,
  shouldAnimateProgressionUnlock,
} from '../utils/treeProgression.ts';

test('empty tree keeps the complete original stage', () => {
  const progression = getTreeProgression(0);
  assert.equal(progression.stage.level, 0);
  assert.equal(progression.stage.name, 'Árvore original');
  assert.equal(progression.nextStage?.threshold, 5);
  assert.equal(progression.remaining, 5);
});

test('every progression threshold activates exactly at its configured count', () => {
  for (const stage of TREE_PROGRESSION_STAGES) {
    assert.equal(getTreeProgression(stage.threshold).stage.level, stage.level);
    if (stage.threshold > 0) assert.equal(getTreeProgression(stage.threshold - 1).stage.level, stage.level - 1);
  }
});

test('full tree exposes every cumulative effect and no next stage', () => {
  const progression = getTreeProgression(60);
  assert.equal(progression.stage.level, 6);
  assert.equal(progression.stage.effects.fullyEnchanted, true);
  assert.ok(progression.stage.effects.goldenParticleCount <= 100);
  assert.equal(progression.nextStage, null);
  assert.equal(progression.progressToNext, 1);
});

test('only persisted social ornaments determine the count', () => {
  const persisted = Array.from({ length: 10 }, (_, index) => ({ public_id: `ornament-${index}` }));
  const decorativeSceneElements = Array.from({ length: 100 }, (_, index) => ({ id: `decorative-${index}` }));
  assert.equal(getTreeProgressionFromOrnaments(persisted).stage.level, 2);
  assert.equal(decorativeSceneElements.length, 100);
});

test('progress indicator reports the exact distance to the next milestone', () => {
  const progression = getTreeProgression(18);
  assert.equal(progression.stage.threshold, 10);
  assert.equal(progression.nextStage?.threshold, 20);
  assert.equal(progression.remaining, 2);
  assert.equal(progression.progressToNext, 0.8);
});

test('confirmed addition unlocks a stage while deletion lowers it without celebration', () => {
  assert.equal(getUnlockedProgressionStage(4, 5, 'persisted-addition')?.level, 1);
  assert.equal(getTreeProgression(4).stage.level, 0);
  assert.equal(getUnlockedProgressionStage(5, 4, 'deletion'), null);
});

test('initial reload and duplicate additions never replay an unlock', () => {
  assert.equal(getUnlockedProgressionStage(0, 35, 'initial-load'), null);
  assert.equal(getUnlockedProgressionStage(10, 10, 'persisted-addition'), null);
});

test('reduced motion preserves the unlock message but suppresses animation', () => {
  const stage = getUnlockedProgressionStage(19, 20, 'persisted-addition');
  assert.equal(shouldAnimateProgressionUnlock(stage, false), true);
  assert.equal(shouldAnimateProgressionUnlock(stage, true), false);
});

test('invalid and negative counts are normalized safely', () => {
  assert.equal(getTreeProgression(-5).ornamentCount, 0);
  assert.equal(getTreeProgression(Number.NaN).ornamentCount, 0);
  assert.equal(getTreeProgression(10.9).ornamentCount, 10);
});

test('derived progression contains no private tree or message data', () => {
  const serialized = JSON.stringify(getTreeProgression(60));
  assert.doesNotMatch(serialized, /message|recovery|token|password|owner/i);
});

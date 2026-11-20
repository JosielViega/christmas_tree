import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AMBIENT_LIMITS,
  SANTA_SCHEDULE,
  SHOOTING_STAR_SCHEDULE,
  advanceAmbientSchedule,
  createAmbientSchedule,
  getAmbientPolicy,
  getInitialAmbientQuality,
  randomDelay,
  resetAmbientSchedule,
} from '../utils/ambientEffects.ts';
import { getTreeProgression } from '../utils/treeProgression.ts';

test('Santa recurring appearances stay inside the requested 45-90 second interval', () => {
  assert.equal(randomDelay(SANTA_SCHEDULE.recurringDelay, () => 0), 45_000);
  const maximum = randomDelay(SANTA_SCHEDULE.recurringDelay, () => 1);
  assert.ok(maximum < 90_000);
  assert.ok(maximum > 89_999);
});

test('ambient effects initialize hidden with an early bounded first appearance', () => {
  const santa = createAmbientSchedule(SANTA_SCHEDULE, () => 0.5);
  const star = createAmbientSchedule(SHOOTING_STAR_SCHEDULE, () => 0.5);
  assert.equal(santa.phase, 'waiting');
  assert.ok(santa.remainingMs >= 15_000 && santa.remainingMs <= 25_000);
  assert.equal(star.phase, 'waiting');
  assert.ok(star.remainingMs >= 8_000 && star.remainingMs <= 16_000);
});

test('scheduler starts, advances and cleans up an occasional effect', () => {
  const config = { initialDelay: { minMs: 100, maxMs: 100 }, recurringDelay: { minMs: 500, maxMs: 500 }, durationMs: 200 };
  const state = createAmbientSchedule(config, () => 0);
  assert.equal(advanceAmbientSchedule(state, 100, true, config, () => 0), 'started');
  assert.equal(state.phase, 'active');
  assert.equal(advanceAmbientSchedule(state, 100, true, config, () => 0), 'none');
  assert.equal(state.progress, 0.5);
  assert.equal(advanceAmbientSchedule(state, 100, true, config, () => 0), 'finished');
  assert.equal(state.phase, 'waiting');
  assert.equal(state.remainingMs, 500);
});

test('paused schedules preserve time and resume from the same point', () => {
  const config = { initialDelay: { minMs: 1_000, maxMs: 1_000 }, recurringDelay: { minMs: 2_000, maxMs: 2_000 }, durationMs: 300 };
  const state = createAmbientSchedule(config, () => 0);
  advanceAmbientSchedule(state, 400, true, config);
  const pausedAt = state.remainingMs;
  advanceAmbientSchedule(state, 5_000, false, config);
  assert.equal(state.remainingMs, pausedAt);
  advanceAmbientSchedule(state, 600, true, config);
  assert.equal(state.phase, 'active');
});

test('reset returns active effects to a clean initial schedule', () => {
  const state = createAmbientSchedule(SHOOTING_STAR_SCHEDULE, () => 0);
  state.phase = 'active';
  state.progress = 0.75;
  resetAmbientSchedule(state, SHOOTING_STAR_SCHEDULE, () => 0);
  assert.deepEqual(state, { phase: 'waiting', remainingMs: 8_000, progress: 0 });
});

test('reduced motion, PNG capture and recording suspend every animation', () => {
  assert.equal(getAmbientPolicy({ reducedMotion: true, captureActive: false, recording: false, quality: 'full' }).animate, false);
  assert.equal(getAmbientPolicy({ reducedMotion: false, captureActive: true, recording: false, quality: 'full' }).animate, false);
  assert.equal(getAmbientPolicy({ reducedMotion: false, captureActive: false, recording: true, quality: 'full' }).animate, false);
  assert.equal(getAmbientPolicy({ reducedMotion: false, captureActive: false, recording: false, quality: 'full' }).animate, true);
});

test('particle and concurrency limits remain bounded by quality', () => {
  assert.deepEqual(AMBIENT_LIMITS.santaTrailParticles, { full: 18, reduced: 8, off: 0 });
  assert.equal(AMBIENT_LIMITS.simultaneousSantas, 1);
  assert.equal(AMBIENT_LIMITS.simultaneousShootingStars, 1);
  assert.equal(getAmbientPolicy({ reducedMotion: false, captureActive: false, recording: false, quality: 'reduced' }).trailParticleCount, 8);
});

test('modest devices begin with reduced optional effects', () => {
  assert.equal(getInitialAmbientQuality({ hardwareConcurrency: 4, deviceMemory: 8 }), 'reduced');
  assert.equal(getInitialAmbientQuality({ hardwareConcurrency: 8, deviceMemory: 4 }), 'reduced');
  assert.equal(getInitialAmbientQuality({ hardwareConcurrency: 8, deviceMemory: 8 }), 'full');
});

test('ambient schedules do not alter participation progression', () => {
  const before = getTreeProgression(35);
  const state = createAmbientSchedule(SANTA_SCHEDULE, () => 0);
  advanceAmbientSchedule(state, 1_000, true, SANTA_SCHEDULE);
  const after = getTreeProgression(35);
  assert.deepEqual(after, before);
});

test('ambient scene has no backend calls, external assets or interactive handlers', () => {
  const source = readFileSync(new URL('../components/AmbientNight.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|\/api\//);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /onClick|onPointer/);
  assert.doesNotMatch(source, /camera\.|OrbitControls|useThree/);
  assert.match(source, /raycast=\{noRaycast\}/);
});

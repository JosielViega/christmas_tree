import assert from 'node:assert/strict';
import test from 'node:test';
import { boundsFitPerspective, perspectiveDistanceForBounds, storyCameraFrame } from '../utils/videoFraming.ts';

const ASPECT = 9 / 16;
const FOV = 50;

test('portrait framing keeps the star and gift base visible throughout the orbit', () => {
  for (let step = 0; step <= 160; step += 1) {
    const frame = storyCameraFrame(step / 160, ASPECT, FOV);
    assert.equal(boundsFitPerspective(frame.distance, FOV, ASPECT), true, `frame ${step} must fit the scene bounds`);
  }
  assert.ok(storyCameraFrame(0, ASPECT, FOV).distance > 30, 'portrait framing must fit the wide gift base');
});

test('eight-second choreography makes one continuous orbit and settles at the front', () => {
  const start = storyCameraFrame(0, ASPECT, FOV);
  const twoSeconds = storyCameraFrame(0.25, ASPECT, FOV);
  const middleOrbit = storyCameraFrame(0.4375, ASPECT, FOV);
  const fiveSeconds = storyCameraFrame(0.625, ASPECT, FOV);
  const sevenSeconds = storyCameraFrame(0.875, ASPECT, FOV);
  const finish = storyCameraFrame(1, ASPECT, FOV);

  assert.equal(start.angleRadians, 0);
  assert.ok(twoSeconds.angleRadians > 0 && twoSeconds.angleRadians < Math.PI);
  assert.ok(Math.abs(middleOrbit.angleRadians - Math.PI) < 1e-10, 'the rear view is reached halfway through the orbit');
  assert.ok(fiveSeconds.angleRadians > Math.PI && fiveSeconds.angleRadians < Math.PI * 2);
  assert.ok(Math.abs(sevenSeconds.angleRadians - Math.PI * 2) < 1e-10);
  assert.deepEqual(sevenSeconds, finish, 'the final second must remain stable at the frontal composition');
  assert.ok(fiveSeconds.distance < start.distance, 'the middle phase applies a restrained zoom');
});

test('orbit angle is monotonic and does not jump between sampled frames', () => {
  let previous = storyCameraFrame(0, ASPECT, FOV);
  for (let step = 1; step <= 240; step += 1) {
    const current = storyCameraFrame(step / 240, ASPECT, FOV);
    assert.ok(current.angleRadians >= previous.angleRadians, `frame ${step} must not reverse direction`);
    assert.ok(current.angleRadians - previous.angleRadians < 0.08, `frame ${step} must not jump`);
    previous = current;
  }
});

test('reduced motion preserves the complete static frontal framing', () => {
  assert.deepEqual(storyCameraFrame(0, ASPECT, FOV, true), storyCameraFrame(1, ASPECT, FOV, true));
  assert.throws(() => perspectiveDistanceForBounds(0, ASPECT, 8, 7));
});

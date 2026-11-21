import assert from 'node:assert/strict';
import test from 'node:test';
import { boundsFitPerspective, perspectiveDistanceForBounds, storyCameraFrame } from '../utils/videoFraming.ts';

test('vertical framing keeps the star and gift base inside the initial projection', () => {
  const aspect = 9 / 16;
  const frame = storyCameraFrame(0, aspect, 50);
  assert.equal(boundsFitPerspective(frame.distance, 50, aspect), true);
  assert.ok(frame.distance > 30, 'portrait framing must move back enough to fit the wide gift base');
});

test('camera holds the full tree for two seconds then moves smoothly without excessive zoom', () => {
  const aspect = 9 / 16;
  const start = storyCameraFrame(0, aspect, 50);
  const twoSeconds = storyCameraFrame(0.25, aspect, 50);
  const middle = storyCameraFrame(0.5, aspect, 50);
  const finish = storyCameraFrame(1, aspect, 50);
  assert.deepEqual(start, twoSeconds);
  assert.ok(middle.distance < start.distance);
  assert.ok(finish.distance >= start.distance * 0.925);
  assert.notEqual(middle.position[0], 0);
});

test('reduced motion preserves the complete static framing', () => {
  assert.deepEqual(storyCameraFrame(0, 9 / 16, 50, true), storyCameraFrame(1, 9 / 16, 50, true));
  assert.throws(() => perspectiveDistanceForBounds(0, 9 / 16, 8, 7));
});

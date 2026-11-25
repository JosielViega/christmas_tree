import assert from 'node:assert/strict';
import test from 'node:test';
import { GIFT_BOX_FACE_NAMES, createGiftBoxGeometry } from '../utils/giftBoxGeometry.ts';

const covarianceSign = (left: number[], right: number[]): number => {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const covariance = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  return Math.sign(covariance);
};

test('rounded gift box exposes six predictable outward-facing UV groups', () => {
  const geometry = createGiftBoxGeometry();
  assert.deepEqual(GIFT_BOX_FACE_NAMES, ['right', 'left', 'top', 'bottom', 'front', 'back']);
  assert.equal(geometry.groups.length, 6);

  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const index = geometry.getIndex();

  const expected = [
    { axisU: 2, signU: -1, axisV: 1, signV: 1 }, // right: screen-right follows -Z
    { axisU: 2, signU: 1, axisV: 1, signV: 1 },  // left: screen-right follows +Z
    { axisU: 0, signU: 1, axisV: 2, signV: -1 }, // top: image top follows -Z
    { axisU: 0, signU: 1, axisV: 2, signV: 1 },  // bottom: image top follows -Z when viewed outward
    { axisU: 0, signU: 1, axisV: 1, signV: 1 },  // front
    { axisU: 0, signU: -1, axisV: 1, signV: 1 }, // back: screen-right follows -X
  ] as const;

  geometry.groups.forEach((group, faceIndex) => {
    const vertices = Array.from(
      { length: group.count },
      (_, offset) => index ? index.getX(group.start + offset) : group.start + offset,
    );
    const axisValues = (axis: number) => vertices.map((vertex) => (
      axis === 0 ? position.getX(vertex) : axis === 1 ? position.getY(vertex) : position.getZ(vertex)
    ));
    const uValues = vertices.map((vertex) => uv.getX(vertex));
    const vValues = vertices.map((vertex) => uv.getY(vertex));
    const rule = expected[faceIndex];
    assert.equal(covarianceSign(axisValues(rule.axisU), uValues), rule.signU, `${GIFT_BOX_FACE_NAMES[faceIndex]} horizontal orientation`);
    assert.equal(covarianceSign(axisValues(rule.axisV), vValues), rule.signV, `${GIFT_BOX_FACE_NAMES[faceIndex]} vertical orientation`);
  });

  geometry.dispose();
});

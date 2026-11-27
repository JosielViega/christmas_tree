import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { applyPolaroidPhotoTexture } from '../utils/polaroidMaterial.ts';

const photoTexture = (name: string) => {
  const value = new THREE.Texture({ width: 512, height: 512 });
  value.name = name;
  value.colorSpace = THREE.SRGBColorSpace;
  value.minFilter = THREE.LinearMipmapLinearFilter;
  value.magFilter = THREE.LinearFilter;
  value.needsUpdate = true;
  return value;
};

test('direct late map assignment does not recompile a previously created material', () => {
  const material = new THREE.MeshBasicMaterial();
  const initialVersion = material.version;
  material.map = photoTexture('late-direct');
  assert.equal(material.version, initialVersion);
});

test('placeholder material recompiles when a photograph arrives later', () => {
  const material = new THREE.MeshBasicMaterial({ map: null });
  const initialVersion = material.version;
  const photograph = photoTexture('persisted-photo');
  assert.equal(applyPolaroidPhotoTexture(material, photograph), true);
  assert.equal(material.map, photograph);
  assert.equal(material.version, initialVersion + 1);
  assert.equal(material.map.image.width, 512);
  assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
});

test('replacement and removal invalidate the material exactly once per change', () => {
  const material = new THREE.MeshBasicMaterial();
  const first = photoTexture('first');
  const second = photoTexture('second');
  applyPolaroidPhotoTexture(material, first);
  const withFirst = material.version;
  assert.equal(applyPolaroidPhotoTexture(material, first), false);
  assert.equal(material.version, withFirst);
  assert.equal(applyPolaroidPhotoTexture(material, second), true);
  assert.equal(material.version, withFirst + 1);
  assert.equal(material.map, second);
  assert.equal(applyPolaroidPhotoTexture(material, null), true);
  assert.equal(material.version, withFirst + 2);
  assert.equal(material.map, null);
});

test('one, three and six persisted photographs transition from placeholder to renderable maps', () => {
  for (const count of [1, 3, 6]) {
    const materials = Array.from({ length: count }, () => new THREE.MeshBasicMaterial({ map: null }));
    const photographs = Array.from({ length: count }, (_, index) => photoTexture(`reload-${count}-${index}`));
    materials.forEach((material, index) => applyPolaroidPhotoTexture(material, photographs[index]));
    assert.equal(materials.filter((material) => material.map !== null && material.version === 1).length, count);
  }
});

test('a failed photograph remains a placeholder and a later retry recompiles it', () => {
  const material = new THREE.MeshBasicMaterial({ map: null });
  assert.equal(material.map, null);
  assert.equal(material.version, 0);
  const retry = photoTexture('retry');
  applyPolaroidPhotoTexture(material, retry);
  assert.equal(material.map, retry);
  assert.equal(material.version, 1);
});

test('tree change removes the old map before applying the next tree photograph', () => {
  const material = new THREE.MeshBasicMaterial();
  const firstTree = photoTexture('tree-a');
  const secondTree = photoTexture('tree-b');
  applyPolaroidPhotoTexture(material, firstTree);
  applyPolaroidPhotoTexture(material, null);
  applyPolaroidPhotoTexture(material, secondTree);
  assert.equal(material.map, secondTree);
  assert.equal(material.version, 3);
});

test('Polaroid applies maps through a layout effect instead of a late declarative map prop', () => {
  const source = readFileSync(new URL('../components/Polaroid.tsx', import.meta.url), 'utf8');
  assert.match(source, /useLayoutEffect\(\(\) => \{/);
  assert.match(source, /applyPolaroidPhotoTexture\(material, texture\)/);
  assert.match(source, /ref=\{photoMaterialRef\}/);
  assert.match(source, /<meshBasicMaterial[\s\S]*toneMapped=\{false\}/);
  assert.match(source, /useRef<THREE\.MeshBasicMaterial>/);
  assert.doesNotMatch(source, /useRef<THREE\.MeshStandardMaterial>/);
  assert.doesNotMatch(source, /map=\{texture \?\? undefined\}/);
});

import * as THREE from 'three';

export const applyPolaroidPhotoTexture = (
  material: THREE.MeshBasicMaterial,
  texture: THREE.Texture | null,
): boolean => {
  if (material.map === texture) return false;
  material.map = texture;
  material.needsUpdate = true;
  return true;
};

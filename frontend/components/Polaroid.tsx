import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { COLORS } from '../constants';
import { PhotoData } from '../types';
import { acquirePolaroidTexture, reportPolaroidTextureApplied } from '../utils/progressiveTextures';

interface PolaroidProps {
  data: PhotoData;
  onPhotoClick: (data: PhotoData) => void;
  isExploded?: boolean;
}

const Polaroid: React.FC<PolaroidProps> = ({
  data,
  onPhotoClick,
  isExploded = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const explodeProgress = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [loadedTexture, setLoadedTexture] = useState<{ url: string; texture: THREE.Texture; resourceId: number } | null>(null);
  const [failedTextureUrl, setFailedTextureUrl] = useState<string | null>(null);
  const vectors = useRef({
    base: new THREE.Vector3(), forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
    floating: new THREE.Vector3(), scale: new THREE.Vector3(), targetQuat: new THREE.Quaternion(),
    baseQuat: new THREE.Quaternion(), wobble: new THREE.Quaternion(), euler: new THREE.Euler(),
  });

  const explodeDir = useMemo(() => {
    return new THREE.Vector3(data.position[0], data.position[1], data.position[2]).normalize().multiplyScalar(15 + Math.random() * 10);
  }, [data.position]);

  useEffect(() => {
    let active = true;
    setLoadedTexture(null);
    setFailedTextureUrl(null);
    const resource = acquirePolaroidTexture(data.url);
    void resource.promise.then((loaded) => {
      if (!active) return;
      setLoadedTexture({ url: data.url, texture: loaded, resourceId: resource.id });
    }).catch(() => { if (active) setFailedTextureUrl(data.url); });
    return () => { active = false; resource.release(); };
  }, [data.url]);

  const texture = loadedTexture?.url === data.url ? loadedTexture.texture : null;
  const textureFailed = failedTextureUrl === data.url;
  useEffect(() => {
    if (texture && loadedTexture) reportPolaroidTextureApplied(loadedTexture.resourceId);
  }, [texture, loadedTexture]);

  useFrame((state) => {
    const targetProgress = isExploded ? 1 : 0;
    const lerpFactor = isExploded ? 0.05 : 0.12; // Faster return
    explodeProgress.current = THREE.MathUtils.lerp(explodeProgress.current, targetProgress, lerpFactor);

    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      const swayAmount = 0.05;

      // Base position (on the tree or exploding away)
      const scratch = vectors.current;
      const basePos = scratch.base.set(
        data.position[0] + explodeDir.x * explodeProgress.current,
        data.position[1] + explodeDir.y * explodeProgress.current,
        data.position[2] + explodeDir.z * explodeProgress.current
      );

      if (explodeProgress.current > 0.01) {
        // Calculate a position in front of the camera for "floating" effect
        const cam = state.camera;
        const forward = scratch.forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
        const right = scratch.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
        const up = scratch.up.set(0, 1, 0).applyQuaternion(cam.quaternion);

        // Use a deterministic scatter based on the photo's original position
        const seed = Math.sin(data.position[0] * 12.9898 + data.position[1] * 78.233) * 43758.5453;
        const offsetX = ((seed * 100) % 10) - 5;
        const offsetY = ((seed * 1000) % 6) - 1; // Moved upward (was -3)
        const offsetZ = 8 + ((seed * 10) % 4); // 8-12 units in front

        // Add some "outer space" floating motion
        const floatTime = time * 0.3;
        const driftX = Math.sin(floatTime + seed) * 0.5;
        const driftY = Math.cos(floatTime * 0.7 + seed) * 0.5;
        const driftZ = Math.sin(floatTime * 0.5 + seed) * 0.3;

        const floatingPos = scratch.floating.copy(cam.position)
          .add(forward.multiplyScalar(offsetZ + driftZ))
          .add(right.multiplyScalar(offsetX + driftX))
          .add(up.multiplyScalar(offsetY + driftY));

        // Lerp between base (exploding) position and floating position
        const floatFactor = Math.pow(explodeProgress.current, 2);
        groupRef.current.position.lerpVectors(basePos, floatingPos, floatFactor);

        // Rotation: Blend between original rotation and facing camera with slight wobble
        const targetQuat = scratch.targetQuat.copy(cam.quaternion);
        const wobble = scratch.wobble.setFromEuler(scratch.euler.set(
            Math.sin(time * 0.2 + seed) * 0.1,
            Math.cos(time * 0.3 + seed) * 0.1,
            Math.sin(time * 0.5 + seed) * 0.1
        ));
        targetQuat.multiply(wobble);

        const baseQuat = scratch.baseQuat.setFromEuler(scratch.euler.set(
            0,
            data.rotation[1] + Math.sin(time * 0.5 + data.position[0]) * 0.02 + explodeProgress.current * 5,
            Math.sin(time + data.position[1]) * swayAmount + explodeProgress.current * 5
        ));
        groupRef.current.quaternion.slerpQuaternions(baseQuat, targetQuat, floatFactor);
      } else {
        groupRef.current.position.copy(basePos);
        groupRef.current.rotation.set(
            0,
            data.rotation[1] + Math.sin(time * 0.5 + data.position[0]) * 0.02,
            Math.sin(time + data.position[1]) * swayAmount
        );
      }

      // Adjusted Base scale
      const baseScale = 0.85;
      const targetScale = hovered ? baseScale * 1.15 : baseScale;
      scratch.scale.set(targetScale, targetScale, targetScale);
      groupRef.current.scale.lerp(scratch.scale, 0.1);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();

    onPhotoClick(data);
  };

  const cursorStyle = 'zoom-in';

  return (
    <group
      ref={groupRef}
      position={data.position}
      rotation={[0, data.rotation[1], 0]}
      scale={[0.85, 0.85, 0.85]}
      onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = cursorStyle;
      }}
      onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
      }}
      onClick={handleClick}
    >
      {/* The String */}
      <mesh position={[0, -0.25, 0]} visible={!isExploded && explodeProgress.current < 0.1}>
        <cylinderGeometry args={[0.015, 0.015, 0.5]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.5} />
      </mesh>

      {/* The Polaroid Body */}
      <group position={[0, -0.5, 0]}>

        {/* GOLD OUTLINE */}
        <mesh position={[0, -0.75, -0.02]}>
          <boxGeometry args={[1.28, 1.58, 0.02]} />
          <meshStandardMaterial
            color="#FFD700"
            metalness={1.0}
            roughness={0.1}
            emissive="#b8860b"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Paper Frame */}
        <mesh position={[0, -0.75, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.04]} />
          <meshStandardMaterial
            color={COLORS.POLAROID_FRAME}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>

        {/* The Photo Area */}
        <mesh position={[0, -0.65, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          <meshStandardMaterial
            map={texture ?? undefined}
            color={texture ? '#ffffff' : textureFailed ? '#5f1d25' : '#253b31'}
            emissive={texture ? '#000000' : '#10251c'}
            emissiveIntensity={texture ? 0 : 0.25}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>

        {/* Backing */}
        <mesh position={[0, -0.75, -0.021]}>
           <planeGeometry args={[1.2, 1.5]} />
           <meshBasicMaterial color={COLORS.POLAROID_BACK} side={THREE.BackSide} />
        </mesh>
      </group>
    </group>
  );
};

export default Polaroid;

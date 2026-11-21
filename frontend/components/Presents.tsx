import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { COLORS, TREE_CONFIG } from '../constants';
import { createProceduralGiftTexture } from '../utils/giftTextures';
import type { GiftWrappingPattern } from '../utils/giftTextures';
import type { PremiumGiftData } from '../types';
import { getPremiumGiftTransform } from '../utils/premiumGiftLayout';
import { getDecorativeGiftTransforms, horizontalGiftDistance } from '../utils/decorativeGiftLayout';
export { getPremiumGiftTransform } from '../utils/premiumGiftLayout';

interface PresentProps {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  color: string;
  pattern: GiftWrappingPattern;
  ribbonColor: string;
  explodeDir?: THREE.Vector3;
  explodeRotation?: THREE.Vector3;
}

// High fidelity ribbon material with sheen and clearcoat
const RibbonMaterial: React.FC<{ color: string }> = ({ color }) => {
  const isMetallic = color !== COLORS.RIBBON; // If not default white, assume Gold/Metallic

  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.15}
      metalness={isMetallic ? 0.6 : 0.1}
      clearcoat={1.0}
      clearcoatRoughness={0.1}
      sheen={1.0}
      sheenRoughness={0.2}
      sheenColor={color}
      side={THREE.DoubleSide}
    />
  );
};

// Shared by the original scene presents and the experimental personalized preview.
const useGiftTexture = (color: string, type: GiftWrappingPattern) => {
  const texture = useMemo(() => createProceduralGiftTexture(color, type), [color, type]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
};

// --- RIBBON COMPONENTS ---

// A single loop of the bow
const RibbonLoop: React.FC<{ rotation?: [number, number, number], scale?: number, color: string }> = ({ rotation = [0,0,0], scale = 1, color }) => {
  const curve = useMemo(() => {
    // Teardrop / Bunny ear shape for loop
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),        // Center knot
      new THREE.Vector3(0.15, 0.2, 0),   // Up and out
      new THREE.Vector3(0.35, 0.25, 0),  // Peak
      new THREE.Vector3(0.4, 0.1, 0),    // Outer edge down
      new THREE.Vector3(0.2, 0.05, 0),   // Return path
      new THREE.Vector3(0, 0.02, 0)      // Back to knot (slightly offset to avoid z-fighting)
    ], true, 'centripetal', 0.5);
  }, []);

  return (
    <group rotation={rotation as any} scale={[scale, scale, scale]}>
      {/* Flatten the tube in Z axis to make it look like a ribbon strip */}
      <mesh scale={[1, 1, 0.05]}>
        <tubeGeometry args={[curve, 32, 0.08, 4, true]} />
        <RibbonMaterial color={color} />
      </mesh>
    </group>
  );
};

// A draping tail
const RibbonTail: React.FC<{ rotation?: [number, number, number], length?: number, color: string }> = ({ rotation = [0,0,0], length = 1, color }) => {
    const curve = useMemo(() => {
      // S-curve for organic draping
      return new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.05, 0),       // Under knot
        new THREE.Vector3(0.15, 0.08, 0),    // Arch up slightly
        new THREE.Vector3(0.3, 0.02, 0),     // Down onto box
        new THREE.Vector3(0.45 * length, 0.01, 0.05),   // End of tail, slightly curled
      ]);
    }, [length]);

    return (
      <group rotation={rotation as any}>
        <mesh scale={[1, 1, 0.03]}>
           {/* Not closed tube */}
          <tubeGeometry args={[curve, 16, 0.07, 4, false]} />
          <RibbonMaterial color={color} />
        </mesh>
      </group>
    );
  };

interface GiftBoxModelProps {
  texture: THREE.Texture;
  frontTexture?: THREE.Texture | null;
  ribbonColor: string;
}

export const GiftBoxModel: React.FC<GiftBoxModelProps> = ({ texture, frontTexture = null, ribbonColor }) => (
  <group>
    <RoundedBox args={[1, 1, 1]} radius={0.02} smoothness={4} position={[0, 0.5, 0]}>
      <meshPhysicalMaterial
        map={texture}
        roughness={0.3}
        metalness={0.1}
        clearcoat={0.3}
        clearcoatRoughness={0.2}
      />
    </RoundedBox>

    {frontTexture && (
      <mesh position={[0, 0.5, 0.506]}>
        <planeGeometry args={[0.94, 0.94]} />
        <meshPhysicalMaterial map={frontTexture} roughness={0.32} metalness={0.05} clearcoat={0.2} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    )}

    <RoundedBox args={[1.02, 1.02, 0.15]} radius={0.02} smoothness={4} position={[0, 0.5, 0]}>
      <RibbonMaterial color={ribbonColor} />
    </RoundedBox>

    <RoundedBox args={[0.15, 1.02, 1.02]} radius={0.02} smoothness={4} position={[0, 0.5, 0]}>
      <RibbonMaterial color={ribbonColor} />
    </RoundedBox>

    <group position={[0, 1.0, 0]}>
      <mesh position={[0, 0.05, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <RibbonMaterial color={ribbonColor} />
      </mesh>
      <RibbonLoop rotation={[0.2, 0, -0.2]} scale={1.2} color={ribbonColor} />
      <RibbonLoop rotation={[0.2, Math.PI, 0.2]} scale={1.2} color={ribbonColor} />
      <RibbonTail rotation={[0, -0.5, 0]} length={1.2} color={ribbonColor} />
      <RibbonTail rotation={[0, Math.PI + 0.5, 0]} length={1.1} color={ribbonColor} />
    </group>
  </group>
);

const PresentBox: React.FC<PresentProps & { isExploded: boolean }> = ({
  position, rotation, scale, color, pattern, ribbonColor, explodeDir, explodeRotation, isExploded
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((state) => {
    const target = isExploded ? 1 : 0;
    const lerpFactor = isExploded ? 0.05 : 0.12; // Faster return
    progress.current = THREE.MathUtils.lerp(progress.current, target, lerpFactor);

    if (groupRef.current && explodeDir && explodeRotation) {
      const time = state.clock.elapsedTime;
      const seed = Math.sin(position.x * 12.9898 + position.z * 78.233) * 43758.5453;
      const floatTime = time * 0.4 + seed;

      // Floating motion in explode mode
      const drift = new THREE.Vector3(
        Math.sin(floatTime) * 0.4,
        Math.cos(floatTime * 0.8) * 0.4,
        Math.sin(floatTime * 0.6) * 0.4
      ).multiplyScalar(progress.current);

      groupRef.current.position.set(
        position.x + explodeDir.x * progress.current + drift.x,
        position.y + explodeDir.y * progress.current + drift.y,
        position.z + explodeDir.z * progress.current + drift.z
      );

      groupRef.current.rotation.set(
        rotation.x + explodeRotation.x * progress.current + (Math.sin(floatTime * 0.2) * 0.2 * progress.current),
        rotation.y + explodeRotation.y * progress.current + (Math.cos(floatTime * 0.3) * 0.2 * progress.current),
        rotation.z + explodeRotation.z * progress.current
      );
    }
  });

  const texture = useGiftTexture(color, pattern);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <GiftBoxModel texture={texture} ribbonColor={ribbonColor} />
    </group>
  );
};

interface PresentsProps {
  isExploded?: boolean;
  specialGiftCount?: number;
  premiumGifts?: PremiumGiftData[];
  onPremiumGiftSelect?: (gift: PremiumGiftData) => void;
}

const PremiumPresent: React.FC<{ gift: PremiumGiftData; onSelect?: (gift: PremiumGiftData) => void }> = ({ gift, onSelect }) => {
  const fallbackTexture = useGiftTexture('#0f8f54', 'checkers');
  const [publishedTexture, setPublishedTexture] = useState<THREE.Texture | null>(null);
  const transform = getPremiumGiftTransform(gift.position_index, gift.layout_version);
  useEffect(() => {
    let active = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(gift.texture_url, (texture) => {
      loaded = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      if (active) setPublishedTexture(texture); else texture.dispose();
    }, undefined, () => { if (active) setPublishedTexture(null); });
    return () => { active = false; loaded?.dispose(); };
  }, [gift.texture_url]);
  const ribbon = gift.gift_style === 'romantic' ? '#e94b68' : gift.gift_style === 'magic' ? '#9f7aea' : '#FFD700';
  return (
    <group position={transform.position} rotation={transform.rotation} scale={0.92}
      onClick={(event) => { event.stopPropagation(); onSelect?.(gift); }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}>
      <pointLight position={[0, 1.1, 0.4]} color="#fff1a1" intensity={0.45} distance={3.4} decay={2} />
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.72, 1.18, 32]} />
        <meshBasicMaterial color="#f2cf62" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <GiftBoxModel texture={publishedTexture ?? fallbackTexture} ribbonColor={ribbon} />
    </group>
  );
};

const Presents: React.FC<PresentsProps> = ({ isExploded = false, specialGiftCount = 0, premiumGifts = [], onPremiumGiftSelect }) => {
  const presents = useMemo(() => {
    const items: PresentProps[] = [];
    const patterns = ['solid', 'stripes', 'dots', 'checkers'] as const;
    getDecorativeGiftTransforms().forEach((transform, index) => {
      const position = new THREE.Vector3(...transform.position);
      items.push({
        position,
        rotation: new THREE.Euler(0, transform.rotationY, 0),
        scale: new THREE.Vector3(transform.scale, transform.scale, transform.scale),
        color: COLORS.PRESENTS[index % COLORS.PRESENTS.length],
        pattern: patterns[index % patterns.length],
        ribbonColor: index % 3 === 0 ? '#FFD700' : COLORS.RIBBON,
        explodeDir: position.clone().normalize().multiplyScalar(22 + index),
        explodeRotation: new THREE.Vector3(2 + index * 0.2, 3 + index * 0.15, 1.5),
      });
    });

    return items;
  }, []);

  const specialPresents = useMemo<PresentProps[]>(() => {
    const positions = [
      [6.4, -TREE_CONFIG.HEIGHT / 2 + 0.2, 1.8],
      [-5.8, -TREE_CONFIG.HEIGHT / 2 + 0.18, 2.7],
      [3.2, -TREE_CONFIG.HEIGHT / 2 + 0.22, -5.9],
      [-3.9, -TREE_CONFIG.HEIGHT / 2 + 0.2, -5.2],
    ] as const;
    return positions.map((position, index) => {
      const vector = new THREE.Vector3(...position);
      return {
        position: vector,
        rotation: new THREE.Euler(0, index * 1.17, 0),
        scale: new THREE.Vector3(0.82 + index * 0.04, 0.82 + index * 0.04, 0.82 + index * 0.04),
        color: index % 2 === 0 ? '#0f8f54' : '#a9192c',
        pattern: index % 2 === 0 ? 'checkers' : 'stripes',
        ribbonColor: '#FFD700',
        explodeDir: vector.clone().normalize().multiplyScalar(26 + index * 2),
        explodeRotation: new THREE.Vector3(2 + index, 3 + index * 0.5, 1.5),
      };
    });
  }, []);

  return (
    <group>
      {presents.filter((present) => premiumGifts.every((gift) => horizontalGiftDistance(
        [present.position.x, present.position.y, present.position.z],
        getPremiumGiftTransform(gift.position_index, gift.layout_version).position,
      ) >= 1.55)).map((p, i) => (
        <PresentBox key={i} {...p} isExploded={isExploded} />
      ))}
      {specialPresents.slice(0, specialGiftCount).map((present, index) => (
        <PresentBox key={`special-${index}`} {...present} isExploded={isExploded} />
      ))}
      {premiumGifts.map((gift) => <PremiumPresent key={gift.public_id} gift={gift} onSelect={onPremiumGiftSelect} />)}
    </group>
  );
};

export default Presents;

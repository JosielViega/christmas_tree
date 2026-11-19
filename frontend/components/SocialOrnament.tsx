import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SocialOrnamentData } from '../types';
import { getOrnamentSlot } from '../utils/math';

interface SocialOrnamentProps {
  ornament: SocialOrnamentData;
  isNew?: boolean;
  onSelect: (ornament: SocialOrnamentData) => void;
}

const heartShape = new THREE.Shape();
heartShape.moveTo(0, -0.45);
heartShape.bezierCurveTo(-0.7, -0.05, -0.62, 0.55, -0.26, 0.55);
heartShape.bezierCurveTo(-0.05, 0.55, 0, 0.38, 0, 0.28);
heartShape.bezierCurveTo(0, 0.38, 0.05, 0.55, 0.26, 0.55);
heartShape.bezierCurveTo(0.62, 0.55, 0.7, -0.05, 0, -0.45);

const starShape = new THREE.Shape();
for (let point = 0; point < 10; point++) {
  const radius = point % 2 === 0 ? 0.58 : 0.25;
  const angle = -Math.PI / 2 + point * Math.PI / 5;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  if (point === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
}
starShape.closePath();

const geometries = {
  bauble: new THREE.SphereGeometry(0.48, 24, 24),
  cap: new THREE.CylinderGeometry(0.14, 0.18, 0.18, 12),
  heart: new THREE.ExtrudeGeometry(heartShape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 2 }),
  star: new THREE.ExtrudeGeometry(starShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }),
  present: new THREE.BoxGeometry(0.82, 0.72, 0.72),
  ribbonFront: new THREE.BoxGeometry(0.14, 0.76, 0.03),
  ribbonTop: new THREE.BoxGeometry(0.14, 0.03, 0.76),
};

const ornamentMaterials: Record<string, THREE.MeshStandardMaterial> = {};
const materialFor = (color: string) => {
  ornamentMaterials[color] ??= new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.22, emissive: color, emissiveIntensity: 0.08 });
  return ornamentMaterials[color];
};
const capMaterial = new THREE.MeshStandardMaterial({ color: '#d9c57a', metalness: 0.8, roughness: 0.2 });
const ribbonMaterial = new THREE.MeshStandardMaterial({ color: '#fff1a1', metalness: 0.35, roughness: 0.3 });

const OrnamentGeometry: React.FC<{ ornament: SocialOrnamentData }> = ({ ornament }) => {
  const material = materialFor(ornament.ornament_color);

  if (ornament.ornament_type.startsWith('bauble_')) {
    return <group><mesh geometry={geometries.bauble} material={material} />{/* cap mirrors the existing reflective baubles */}<mesh position={[0, 0.5, 0]} geometry={geometries.cap} material={capMaterial} /></group>;
  }
  if (ornament.ornament_type === 'heart') {
    return <mesh scale={0.9} geometry={geometries.heart} material={material} />;
  }
  if (ornament.ornament_type === 'star') {
    return <mesh scale={1.05} geometry={geometries.star} material={material} />;
  }
  return <group><mesh geometry={geometries.present} material={material} /><mesh position={[0, 0, 0.37]} geometry={geometries.ribbonFront} material={ribbonMaterial} /><mesh position={[0, 0.37, 0]} geometry={geometries.ribbonTop} material={ribbonMaterial} /></group>;
};

const SocialOrnament: React.FC<SocialOrnamentProps> = ({ ornament, isNew = false, onSelect }) => {
  const group = useRef<THREE.Group>(null);
  const slot = useMemo(() => getOrnamentSlot(ornament.slot_index, ornament.layout_version), [ornament.slot_index, ornament.layout_version]);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const appearedAt = useRef(performance.now());

  useFrame((state, delta) => {
    if (!group.current) return;
    const elapsed = (performance.now() - appearedAt.current) / 1000;
    const targetScale = isNew && !reducedMotion ? Math.min(1, elapsed * 2.4) : 1;
    group.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(1, delta * 10));
    if (!reducedMotion) {
      group.current.rotation.y = slot.rotation[1] + Math.sin(state.clock.elapsedTime * 1.2 + ornament.slot_index) * 0.08;
      group.current.position.y = slot.position[1] + Math.sin(state.clock.elapsedTime * 1.5 + ornament.slot_index) * 0.035;
    }
  });

  return (
    <group
      ref={group}
      position={slot.position}
      rotation={slot.rotation}
      scale={isNew && !reducedMotion ? 0.01 : 1}
      onClick={(event) => { event.stopPropagation(); onSelect(ornament); }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <OrnamentGeometry ornament={ornament} />
      {isNew && <pointLight color={ornament.ornament_color} intensity={1.5} distance={3} decay={2} />}
    </group>
  );
};

export default React.memo(SocialOrnament);

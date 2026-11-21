import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import {
  advanceAmbientSchedule,
  createAmbientSchedule,
  getAmbientPolicy,
  SANTA_SCHEDULE,
  SHOOTING_STAR_SCHEDULE,
} from '../utils/ambientEffects';
import type { AmbientQuality } from '../utils/ambientEffects';

interface AmbientNightProps {
  quality: AmbientQuality;
  reducedMotion: boolean;
  recording: boolean;
  captureActive: React.MutableRefObject<boolean>;
}

const noRaycast = () => null;
const smoothStep = (value: number) => value * value * (3 - 2 * value);

const Reindeer: React.FC<{ x: number }> = ({ x }) => (
  <group position={[x, -0.05, 0]}>
    <mesh raycast={noRaycast} scale={[0.65, 0.36, 0.28]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#75411f" roughness={0.9} /></mesh>
    <mesh raycast={noRaycast} position={[0.55, 0.28, 0]} scale={[0.26, 0.32, 0.24]}><sphereGeometry args={[1, 9, 7]} /><meshStandardMaterial color="#8b5630" roughness={0.9} /></mesh>
    <mesh raycast={noRaycast} position={[0.78, 0.27, 0]} scale={0.08}><sphereGeometry args={[1, 7, 6]} /><meshBasicMaterial color="#ff4a32" toneMapped={false} /></mesh>
  </group>
);

const SantaSleigh: React.FC<AmbientNightProps> = ({ quality, reducedMotion, recording, captureActive }) => {
  const group = useRef<THREE.Group>(null);
  const schedule = useRef(createAmbientSchedule(SANTA_SCHEDULE));
  const debugForced = useRef(false);
  const trailCount = getAmbientPolicy({ reducedMotion, captureActive: false, recording, quality }).trailParticleCount;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const preview = (event: Event) => {
      if ((event as CustomEvent).detail !== 'santa') return;
      schedule.current = { phase: 'active', remainingMs: SANTA_SCHEDULE.durationMs, progress: 0 };
      debugForced.current = true;
    };
    window.addEventListener('christmas-tree:ambient-preview', preview);
    return () => window.removeEventListener('christmas-tree:ambient-preview', preview);
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    const animate = debugForced.current || (!reducedMotion && !captureActive.current && !recording && quality !== 'off');
    const transition = advanceAmbientSchedule(schedule.current, delta * 1_000, animate, SANTA_SCHEDULE);
    if (debugForced.current && transition === 'finished') debugForced.current = false;
    const visible = animate && schedule.current.phase === 'active';
    group.current.visible = visible;
    if (!visible) return;

    const progress = smoothStep(schedule.current.progress);
    group.current.position.set(
      THREE.MathUtils.lerp(-27, 27, progress),
      10.5 + Math.sin(progress * Math.PI) * 2 + Math.sin(state.clock.elapsedTime * 3.5) * 0.12,
      -16,
    );
    group.current.rotation.z = -0.04 + Math.sin(state.clock.elapsedTime * 2.2) * 0.025;
  });

  return (
    <group ref={group} visible={false} scale={0.72}>
      <group position={[-1.2, 0, 0]}>
        <mesh raycast={noRaycast} scale={[1.35, 0.42, 0.62]}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#b8182c" metalness={0.25} roughness={0.45} /></mesh>
        <mesh raycast={noRaycast} position={[-0.15, 0.72, 0]} scale={[0.42, 0.7, 0.42]}><sphereGeometry args={[1, 12, 9]} /><meshStandardMaterial color="#c92135" roughness={0.7} /></mesh>
        <mesh raycast={noRaycast} position={[-0.15, 1.35, 0]} scale={0.3}><sphereGeometry args={[1, 12, 9]} /><meshStandardMaterial color="#f1c6a5" roughness={0.9} /></mesh>
        <mesh raycast={noRaycast} position={[-0.32, 1.58, 0]} rotation={[0, 0, 0.28]}><coneGeometry args={[0.34, 0.8, 12]} /><meshStandardMaterial color="#c92135" roughness={0.8} /></mesh>
        <mesh raycast={noRaycast} position={[-0.48, 1.89, 0]} scale={0.13}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#fff5dc" /></mesh>
        <mesh raycast={noRaycast} position={[0, -0.52, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.2, 0.07, 6, 24, Math.PI]} /><meshStandardMaterial color="#f2cf62" metalness={0.8} roughness={0.25} /></mesh>
      </group>
      <Reindeer x={1.4} />
      <Reindeer x={3.1} />
      <mesh raycast={noRaycast} position={[1.2, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 3.8, 5]} /><meshBasicMaterial color="#d9b76c" /></mesh>
      {trailCount > 0 && <Sparkles raycast={noRaycast} position={[-4.2, 0.25, 0]} count={trailCount} scale={[4.5, 1.2, 1.2]} size={2.2} speed={0.35} opacity={0.75} color="#fff1a1" material-toneMapped={false} />}
    </group>
  );
};

const ShootingStar: React.FC<AmbientNightProps> = ({ quality, reducedMotion, recording, captureActive }) => {
  const group = useRef<THREE.Group>(null);
  const schedule = useRef(createAmbientSchedule(SHOOTING_STAR_SCHEDULE));
  const debugForced = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const preview = (event: Event) => {
      if ((event as CustomEvent).detail !== 'star') return;
      schedule.current = { phase: 'active', remainingMs: SHOOTING_STAR_SCHEDULE.durationMs, progress: 0 };
      debugForced.current = true;
    };
    window.addEventListener('christmas-tree:ambient-preview', preview);
    return () => window.removeEventListener('christmas-tree:ambient-preview', preview);
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;
    const animate = debugForced.current || (!reducedMotion && !captureActive.current && !recording && quality !== 'off');
    const transition = advanceAmbientSchedule(schedule.current, delta * 1_000, animate, SHOOTING_STAR_SCHEDULE);
    if (debugForced.current && transition === 'finished') debugForced.current = false;
    const visible = animate && schedule.current.phase === 'active';
    group.current.visible = visible;
    if (!visible) return;
    const progress = smoothStep(schedule.current.progress);
    group.current.position.set(
      THREE.MathUtils.lerp(-18, 18, progress),
      THREE.MathUtils.lerp(14, 7.5, progress),
      -22,
    );
  });

  return (
    <group ref={group} visible={false} rotation={[0, 0, -0.18]}>
      <mesh raycast={noRaycast} scale={0.16}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      <mesh raycast={noRaycast} position={[-2.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.12, 5, 8, 1, true]} /><meshBasicMaterial color="#fff1a1" transparent opacity={0.42} toneMapped={false} /></mesh>
      <pointLight color="#fff1a1" intensity={0.35} distance={5} decay={2} />
    </group>
  );
};

const AmbientNight: React.FC<AmbientNightProps> = (props) => (
  <group>
    <hemisphereLight color="#182844" groundColor="#041008" intensity={0.1} />
    <SantaSleigh {...props} />
    <ShootingStar {...props} />
  </group>
);

export default AmbientNight;

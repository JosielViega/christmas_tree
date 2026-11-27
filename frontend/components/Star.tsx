import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, TREE_CONFIG } from '../constants';

interface StarProps {
  isExploded?: boolean;
  glowBoost?: number;
  celebrating?: boolean;
  sparkleScale?: number;
  animationsEnabled?: boolean;
}

const Star: React.FC<StarProps> = ({
  isExploded = false,
  glowBoost = 0,
  celebrating = false,
  sparkleScale = 1,
  animationsEnabled = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const explodeProgress = useRef(0);

  // Classic 5-Pointed Star Shape
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerRadius = 1.5;
    const innerRadius = 0.6;

    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      // Point up: start at PI/2
      const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.1,
      bevelSegments: 3
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    return geo;
  }, []);
  useEffect(() => () => starGeometry.dispose(), [starGeometry]);

  useFrame((state) => {
    const targetProgress = isExploded ? 1 : 0;
    const lerpFactor = isExploded ? 0.05 : 0.12; // Faster return
    explodeProgress.current = THREE.MathUtils.lerp(explodeProgress.current, targetProgress, lerpFactor);

    if (groupRef.current) {
      const time = state.clock.elapsedTime;

      // Gentle floating motion + Explode offset
      const baseY = (TREE_CONFIG.HEIGHT / 2) + 0.8;
      groupRef.current.position.y = baseY + (animationsEnabled ? Math.sin(time * 1.5) * 0.1 : 0) + explodeProgress.current * 20;

      // Slow rotation + Explode spin
      groupRef.current.rotation.y = animationsEnabled ? time * (0.5 + explodeProgress.current * 5) : 0;
      groupRef.current.rotation.z = animationsEnabled ? Math.sin(time * 0.5) * 0.1 : 0;

      // Pulsing scale
      const celebrationPulse = animationsEnabled && celebrating ? Math.sin(time * 8) * 0.04 : 0;
      const pulse = 1 + (animationsEnabled ? Math.sin(time * 3) * (0.05 + glowBoost * 0.015) : 0) + celebrationPulse;
      groupRef.current.scale.set(pulse, pulse, pulse);

      // Pulse the light intensity
      if (glowRef.current) {
        const celebrationLight = celebrating ? 1.2 : 0;
        glowRef.current.intensity = (3 + glowBoost * 2 + celebrationLight + (animationsEnabled ? Math.sin(time * 3) : 0)) * (1 - explodeProgress.current * 0.8);
      }
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = 0.7 + glowBoost * 0.75 + (celebrating ? 0.35 : 0);
      }
    }
  });

  const startY = (TREE_CONFIG.HEIGHT / 2) + 0.8;

  return (
    <group ref={groupRef} position={[0, startY, 0]}>

      {/* GLOW HALO */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh scale={[16, 16, 1]}>
          <planeGeometry />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            uniforms={{ uOpacity: { value: 0.3 + glowBoost * 0.12 } }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float uOpacity;
              varying vec2 vUv;
              void main() {
                float radius = length((vUv - vec2(0.5)) * 2.0);
                if (radius >= 1.0) discard;
                float alpha = pow(1.0 - smoothstep(0.0, 1.0, radius), 1.7) * uOpacity;
                vec3 halo = mix(vec3(1.0, 0.78, 0.12), vec3(1.0, 1.0, 0.82), 1.0 - radius);
                gl_FragColor = vec4(halo, alpha);
              }
            `}
          />
        </mesh>
      </Billboard>

      {/* The 3D Star Mesh */}
      <mesh geometry={starGeometry}>
        <meshStandardMaterial
          ref={materialRef}
          color={COLORS.STAR}
          emissive={COLORS.STAR_GLOW}
          emissiveIntensity={0.7}
          metalness={0.72}
          roughness={0.26}
        />
      </mesh>

      {/* Extra Sparkles for magical feel */}
      {sparkleScale > 0 && <Sparkles count={Math.max(4, Math.round((20 + glowBoost * 16) * sparkleScale))} scale={4} size={3} speed={animationsEnabled ? 0.4 + glowBoost * 0.15 : 0} opacity={0.8} color="#fff" material-toneMapped={false} />}

      {/* Light Source inside the star - No shadows for performance */}
      <pointLight
        ref={glowRef}
        color={COLORS.STAR_GLOW}
        distance={30}
        decay={2}
        castShadow={false}
      />
    </group>
  );
};

export default Star;

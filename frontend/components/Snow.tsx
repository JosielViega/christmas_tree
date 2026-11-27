import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Snow: React.FC<{ isExploded?: boolean; atmosphereBoost?: number; count?: number; animationsEnabled?: boolean }> = ({
  isExploded = false,
  atmosphereBoost = 0,
  count = 1200,
  animationsEnabled = true,
}) => {
  const mesh = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const explodeProgress = useRef(0);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const explodeDirs = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Spread across a wide area
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 50 - 10;
      const z = (Math.random() - 0.5) * 60;

      positions[i * 3] = x; // x
      positions[i * 3 + 1] = y; // y
      positions[i * 3 + 2] = z; // z

      velocities[i] = 0.02 + Math.random() * 0.08;

      // Explode direction: away from center
      const dir = new THREE.Vector3(x, y, z).normalize().multiplyScalar(20 + Math.random() * 20);
      explodeDirs[i * 3] = dir.x;
      explodeDirs[i * 3 + 1] = dir.y;
      explodeDirs[i * 3 + 2] = dir.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
    geo.setAttribute('explodeDir', new THREE.BufferAttribute(explodeDirs, 3));
    return { geo };
  }, [count]);
  useEffect(() => () => particles.geo.dispose(), [particles]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplodeProgress: { value: 0 },
    uSize: { value: 0.25 }
  }), []);

  useFrame((state) => {
    if (!materialRef.current) return;

    const targetProgress = isExploded ? 1 : 0;
    const lerpFactor = isExploded ? 0.05 : 0.12;
    explodeProgress.current = THREE.MathUtils.lerp(explodeProgress.current, targetProgress, lerpFactor);

    if (animationsEnabled) materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uExplodeProgress.value = explodeProgress.current;
    materialRef.current.uniforms.uSize.value = 0.25 + atmosphereBoost * 0.08;
  });

  return (
    <points ref={mesh} geometry={particles.geo}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uExplodeProgress;
          uniform float uSize;
          attribute float velocity;
          attribute vec3 explodeDir;

          void main() {
            vec3 pos = position;

            // Base falling motion
            float fall = mod(uTime * velocity * 50.0, 50.0);
            pos.y -= fall;

            // Wrap around Y
            if (pos.y < -10.0) pos.y += 50.0;

            // Explosion
            pos += explodeDir * uExplodeProgress;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = uSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          void main() {
            float pointRadius = distance(gl_PointCoord, vec2(0.5));
            if (pointRadius >= 0.5) discard;
            float alpha = 1.0 - smoothstep(0.32, 0.5, pointRadius);
            gl_FragColor = vec4(vec3(1.0), alpha);
          }
        `}
      />
    </points>
  );
};

export default Snow;

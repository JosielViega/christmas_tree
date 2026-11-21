import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Lightformer, Sparkles, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Noise, Vignette, BrightnessContrast, ChromaticAberration, SMAA, DepthOfField } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import TreeMesh from './TreeMesh';
import SpiralDecor from './SpiralDecor';
import Polaroid from './Polaroid';
import Star from './Star';
import Presents from './Presents';
import Snow from './Snow';
import SocialOrnament from './SocialOrnament';
import AmbientNight from './AmbientNight';
import { CAMERA_CONFIG, COLORS, GESTURE_THRESHOLDS } from '../constants';
import { PhotoData, ControlMode, ZoomLevel, PremiumGiftData, SocialOrnamentData } from '../types';
import {
  STORY_SCENE_HEIGHT,
  STORY_SCENE_WIDTH,
  withTemporaryCaptureState,
} from '../utils/socialSharing';
import type { StoryFrameCapture } from '../utils/socialSharing';
import type { StoryVideoSceneCapture } from '../utils/videoRecording';
import { STORY_VIDEO_DURATION_MS } from '../utils/videoRecording';
import type { TreeProgressionEffects } from '../utils/treeProgression';
import { getInitialAmbientQuality } from '../utils/ambientEffects';
import type { AmbientQuality } from '../utils/ambientEffects';
import { storyCameraFrame } from '../utils/videoFraming';

interface SceneProps {
  photos: PhotoData[];
  onPhotoClick: (data: PhotoData) => void;
  controlMode: ControlMode;
  zoomLevel: ZoomLevel;
  panOffset: React.MutableRefObject<{ x: number, y: number }>;
  focusedPhoto: PhotoData | null;
  isExploded?: boolean;
  isRecording?: boolean;
  recordingType?: 'FULL' | 'ALBUM' | null;
  userName?: string;
  ornaments: SocialOrnamentData[];
  newOrnamentId: string | null;
  onOrnamentSelect: (ornament: SocialOrnamentData) => void;
  premiumGifts: PremiumGiftData[];
  onPremiumGiftSelect: (gift: PremiumGiftData) => void;
  onStoryCaptureReady?: (capture: StoryFrameCapture | null) => void;
  onStoryVideoCaptureReady?: (capture: StoryVideoSceneCapture | null) => void;
  progressionEffects: TreeProgressionEffects;
  isProgressionCelebrating?: boolean;
  reducedMotion: boolean;
  paused?: boolean;
}

const TREE_OFFSET_Y = -2;

const SceneEffects: React.FC<{
  zoomLevel: ZoomLevel;
  focusedPhoto: PhotoData | null;
  isRecording: boolean;
  recordingType: 'FULL' | 'ALBUM' | null;
  photos: PhotoData[];
  progressionGlow: number;
}> = ({ progressionGlow }) => {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom
        intensity={0.5 + progressionGlow * 0.12}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.9}
      />

      <Vignette eskil={false} offset={0.1} darkness={1.1} />
    </EffectComposer>
  );
};

const CameraController: React.FC<{
  zoomLevel: ZoomLevel;
  controlMode: ControlMode;
  panOffset: React.MutableRefObject<{ x: number, y: number }>;
  focusedPhoto: PhotoData | null;
  isRecording: boolean;
  recordingType: 'FULL' | 'ALBUM' | null;
  photos: PhotoData[];
  captureActive: React.MutableRefObject<boolean>;
  reducedMotion: boolean;
}> = ({ zoomLevel, controlMode, panOffset, focusedPhoto, isRecording, recordingType, photos, captureActive, reducedMotion }) => {
  const { camera, controls } = useThree();
  const targetPos = useRef(CAMERA_CONFIG.DEFAULT_POS.clone());
  const lookAtTarget = useRef(CAMERA_CONFIG.LOOK_AT_OFFSET.clone());
  const isAnimating = useRef(false);
  const recordingStartTime = useRef(0);

  // Track current camera state for smoother transitions
  const currentCamState = useRef({
    angle: Math.atan2(CAMERA_CONFIG.DEFAULT_POS.x, CAMERA_CONFIG.DEFAULT_POS.z),
    height: CAMERA_CONFIG.DEFAULT_POS.y,
    radius: CAMERA_CONFIG.DEFAULT_POS.z
  });

  // Ensure camera starts centered on the tree
  useEffect(() => {
    camera.position.copy(CAMERA_CONFIG.DEFAULT_POS);
    camera.lookAt(CAMERA_CONFIG.LOOK_AT_OFFSET);
    if (controls) {
      const orbitControls = controls as any;
      orbitControls.target.copy(CAMERA_CONFIG.LOOK_AT_OFFSET);
      orbitControls.update();
    }
  }, [camera, controls]);

  useEffect(() => {
    // Reset panning when switching modes or zoom levels
    if (controlMode === ControlMode.HAND) {
      if (zoomLevel === ZoomLevel.FULL_TREE) {
        targetPos.current.copy(CAMERA_CONFIG.DEFAULT_POS);
        panOffset.current = { x: 0, y: 0 };
      }

      // Sync state for smooth hand control start
      const relX = camera.position.x;
      const relZ = camera.position.z;
      currentCamState.current.angle = Math.atan2(relX, relZ);
      currentCamState.current.radius = Math.sqrt(relX * relX + relZ * relZ);
      currentCamState.current.height = camera.position.y;
    }

    // Start animation for Mouse Mode transitions (Zoom In or Out)
    if (controlMode === ControlMode.MOUSE) {
      isAnimating.current = true;

      // Sync internal state to current camera position to avoid jumps
      const orbitControls = controls as any;
      const target = orbitControls?.target || CAMERA_CONFIG.LOOK_AT_OFFSET;
      const relX = camera.position.x - target.x;
      const relZ = camera.position.z - target.z;

      currentCamState.current.angle = Math.atan2(relX, relZ);
      currentCamState.current.radius = Math.sqrt(relX * relX + relZ * relZ);
      currentCamState.current.height = camera.position.y;
    }

    if (isRecording) {
      recordingStartTime.current = performance.now();

      // Sync internal state to current camera position to avoid jumps
      const orbitControls = controls as any;
      const target = orbitControls?.target || CAMERA_CONFIG.LOOK_AT_OFFSET;
      const relX = camera.position.x - target.x;
      const relZ = camera.position.z - target.z;

      currentCamState.current.angle = Math.atan2(relX, relZ);
      currentCamState.current.radius = Math.sqrt(relX * relX + relZ * relZ);
      currentCamState.current.height = camera.position.y;
    }
  }, [zoomLevel, controlMode, focusedPhoto, isRecording]);

  useFrame((state, delta) => {
    if (captureActive.current) return;
    // 0. RECORDING LOGIC
    if (isRecording) {
      const time = (performance.now() - recordingStartTime.current) / 1000;

      if (recordingType === 'FULL') {
        // Full Tree Rotation - Faster (360 degrees in 8s)
        const angle = time * (Math.PI * 2 / 8);
        const radius = 32;
        camera.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        camera.lookAt(0, -1, 0);
        if (controls) (controls as any).update();
        return;
      } else if (recordingType === 'ALBUM' && photos.length > 0) {
        // Album Mode - Cycle through photos
        const photoInterval = 1;
        const index = Math.min(Math.floor(time / photoInterval), photos.length - 1);
        const photo = photos[index];

        const orbitControls = controls as any;
        if (orbitControls) {
          const photoPos = new THREE.Vector3(...photo.position);
          photoPos.y += TREE_OFFSET_Y;

          // Smoothly move target - faster for 1s interval
          orbitControls.target.lerp(photoPos, 8 * delta);

          // Calculate target camera state
          const targetAngle = photo.rotation[1];
          const targetHeight = photoPos.y;
          const targetRadius = 6;

          // Smoothly interpolate the state components (prevents cutting through tree)
          let angleDiff = targetAngle - currentCamState.current.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          const lerpSpeed = 6 * delta;
          currentCamState.current.angle += angleDiff * lerpSpeed;
          currentCamState.current.height += (targetHeight - currentCamState.current.height) * lerpSpeed;
          currentCamState.current.radius += (targetRadius - currentCamState.current.radius) * lerpSpeed;

          // Apply state to camera position relative to the CURRENT target for smoother tracking
          const camX = orbitControls.target.x + Math.sin(currentCamState.current.angle) * currentCamState.current.radius;
          const camZ = orbitControls.target.z + Math.cos(currentCamState.current.angle) * currentCamState.current.radius;
          const camY = currentCamState.current.height;

          camera.position.set(camX, camY, camZ);
          orbitControls.update();
        }
        return;
      }
    }

    // 1. HAND CONTROL LOGIC (Gestures)
    if (controlMode === ControlMode.HAND) {
      let targetAngle, targetHeight, targetRadius;

      if (zoomLevel === ZoomLevel.ZOOMED_IN) {
        // Calculate Cylindrical coordinates for zooming into the tree
        targetAngle = panOffset.current.x; // Azimuth
        let h = CAMERA_CONFIG.ZOOM_IN_POS.y + panOffset.current.y;

        // Clamp Height to stay on tree
        h = Math.max(CAMERA_CONFIG.MIN_HEIGHT, Math.min(CAMERA_CONFIG.MAX_HEIGHT, h));
        panOffset.current.y = h - CAMERA_CONFIG.ZOOM_IN_POS.y;

        targetHeight = h;
        targetRadius = CAMERA_CONFIG.ZOOM_IN_POS.z;
        lookAtTarget.current.set(0, h - 1, 0);
      } else {
        // Full Tree View - Allow Rotation (Orbit)
        targetAngle = panOffset.current.x;
        targetRadius = CAMERA_CONFIG.DEFAULT_POS.z;
        targetHeight = CAMERA_CONFIG.DEFAULT_POS.y;
        lookAtTarget.current.copy(CAMERA_CONFIG.LOOK_AT_OFFSET);
      }

      // Smoothly interpolate the state components
      const smoothing = GESTURE_THRESHOLDS.SMOOTHING_FACTOR;

      let angleDiff = targetAngle - currentCamState.current.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      currentCamState.current.angle += angleDiff * smoothing;
      currentCamState.current.height += (targetHeight - currentCamState.current.height) * smoothing;
      currentCamState.current.radius += (targetRadius - currentCamState.current.radius) * smoothing;

      // Apply state to camera position
      const camX = Math.sin(currentCamState.current.angle) * currentCamState.current.radius;
      const camZ = Math.cos(currentCamState.current.angle) * currentCamState.current.radius;
      const camY = currentCamState.current.height;

      camera.position.set(camX, camY, camZ);
      camera.lookAt(lookAtTarget.current);
    }

    // 2. MOUSE CONTROL LOGIC (Animation)
    else if (controlMode === ControlMode.MOUSE && isAnimating.current) {
      if (controls) {
        const orbitControls = controls as any;
        const lerpSpeed = reducedMotion ? 1 : Math.min(1, 4 * delta);

        if (zoomLevel === ZoomLevel.ZOOMED_IN && focusedPhoto) {
          // ZOOM IN TO PHOTO
          const photoPos = new THREE.Vector3(...focusedPhoto.position);
          photoPos.y += TREE_OFFSET_Y; // Adjust for group offset

          // Move target to the photo
          orbitControls.target.lerp(photoPos, lerpSpeed);

          // Calculate target camera state
          const targetAngle = focusedPhoto.rotation[1];
          const targetHeight = photoPos.y;
          const targetRadius = 6;

          // Smoothly interpolate the state components
          // This prevents the camera from cutting through the tree

          // Handle angle wrap-around for shortest path
          let angleDiff = targetAngle - currentCamState.current.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          currentCamState.current.angle += angleDiff * lerpSpeed;
          currentCamState.current.height += (targetHeight - currentCamState.current.height) * lerpSpeed;
          currentCamState.current.radius += (targetRadius - currentCamState.current.radius) * lerpSpeed;

          // Apply state to camera position
          const camX = photoPos.x + Math.sin(currentCamState.current.angle) * currentCamState.current.radius;
          const camZ = photoPos.z + Math.cos(currentCamState.current.angle) * currentCamState.current.radius;
          const camY = currentCamState.current.height;

          camera.position.set(camX, camY, camZ);
          orbitControls.update();

          // Check if we have arrived
          const idealPos = new THREE.Vector3(
            photoPos.x + Math.sin(targetAngle) * targetRadius,
            targetHeight,
            photoPos.z + Math.cos(targetAngle) * targetRadius
          );

          if (camera.position.distanceTo(idealPos) < 0.01 && orbitControls.target.distanceTo(photoPos) < 0.01) {
            isAnimating.current = false;
          }
        } else if (zoomLevel === ZoomLevel.FULL_TREE) {
          // ZOOM OUT TO FULL TREE
          orbitControls.target.lerp(CAMERA_CONFIG.LOOK_AT_OFFSET, lerpSpeed);

          // Also interpolate state back to default
          const targetAngle = Math.atan2(CAMERA_CONFIG.DEFAULT_POS.x, CAMERA_CONFIG.DEFAULT_POS.z);
          const targetHeight = CAMERA_CONFIG.DEFAULT_POS.y;
          const targetRadius = CAMERA_CONFIG.DEFAULT_POS.z;

          let angleDiff = targetAngle - currentCamState.current.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          currentCamState.current.angle += angleDiff * lerpSpeed;
          currentCamState.current.height += (targetHeight - currentCamState.current.height) * lerpSpeed;
          currentCamState.current.radius += (targetRadius - currentCamState.current.radius) * lerpSpeed;

          const camX = Math.sin(currentCamState.current.angle) * currentCamState.current.radius;
          const camZ = Math.cos(currentCamState.current.angle) * currentCamState.current.radius;
          const camY = currentCamState.current.height;

          camera.position.set(camX, camY, camZ);
          orbitControls.update();

          if (camera.position.distanceTo(CAMERA_CONFIG.DEFAULT_POS) < 0.1) {
            isAnimating.current = false;
          }
        }
      }
    }
  });

  return (
    <OrbitControls
      enabled={controlMode === ControlMode.MOUSE}
      enableZoom={true}
      enablePan={controlMode === ControlMode.MOUSE}
      minDistance={2}
      maxDistance={100}
      makeDefault
    />
  );
};

interface StoryCaptureSnapshot {
  cameraPosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  cameraUp: THREE.Vector3;
  cameraAspect: number;
  cameraFov: number;
  cameraZoom: number;
  controlsTarget: THREE.Vector3 | null;
  controlsEnabled: boolean | null;
  width: number;
  height: number;
  top: number;
  left: number;
  dpr: number;
  toneMappingExposure: number;
}

const nextRenderedFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const StoryCaptureController: React.FC<{
  captureActive: React.MutableRefObject<boolean>;
  onReady?: (capture: StoryFrameCapture | null) => void;
  onVideoReady?: (capture: StoryVideoSceneCapture | null) => void;
}> = ({ captureActive, onReady, onVideoReady }) => {
  const camera = useThree((current) => current.camera);
  const controls = useThree((current) => current.controls);
  const gl = useThree((current) => current.gl);
  const getState = useThree((current) => current.get);
  const invalidate = useThree((current) => current.invalidate);
  const setDpr = useThree((current) => current.setDpr);
  const setSize = useThree((current) => current.setSize);
  const videoAnimation = useRef<{ startedAt: number; durationMs: number; reducedMotion: boolean } | null>(null);
  const activeStop = useRef<(() => void) | null>(null);

  useFrame(() => {
    const animation = videoAnimation.current;
    if (!animation || !(camera instanceof THREE.PerspectiveCamera)) return;
    const progress = Math.min(1, (performance.now() - animation.startedAt) / animation.durationMs);
    const frame = storyCameraFrame(progress, camera.aspect, camera.fov, animation.reducedMotion);
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
  });

  useEffect(() => {
    if ((!onReady && !onVideoReady) || !(camera instanceof THREE.PerspectiveCamera)) return;

    const orbitControls = controls as { target?: THREE.Vector3; enabled?: boolean; update?: () => void } | null;
    const snapshot = (): StoryCaptureSnapshot => {
      const current = getState();
      return {
        cameraPosition: camera.position.clone(),
        cameraQuaternion: camera.quaternion.clone(),
        cameraUp: camera.up.clone(),
        cameraAspect: camera.aspect,
        cameraFov: camera.fov,
        cameraZoom: camera.zoom,
        controlsTarget: orbitControls?.target?.clone() ?? null,
        controlsEnabled: typeof orbitControls?.enabled === 'boolean' ? orbitControls.enabled : null,
        width: current.size.width,
        height: current.size.height,
        top: current.size.top,
        left: current.size.left,
        dpr: current.viewport.dpr,
        toneMappingExposure: gl.toneMappingExposure,
      };
    };
    const restore = (saved: StoryCaptureSnapshot) => {
      try {
        videoAnimation.current = null;
        camera.position.copy(saved.cameraPosition);
        camera.quaternion.copy(saved.cameraQuaternion);
        camera.up.copy(saved.cameraUp);
        camera.aspect = saved.cameraAspect;
        camera.fov = saved.cameraFov;
        camera.zoom = saved.cameraZoom;
        camera.updateProjectionMatrix();
        gl.toneMappingExposure = saved.toneMappingExposure;
        if (orbitControls) {
          if (saved.controlsTarget && orbitControls.target) orbitControls.target.copy(saved.controlsTarget);
          if (saved.controlsEnabled !== null) orbitControls.enabled = saved.controlsEnabled;
          orbitControls.update?.();
        }
        setDpr(saved.dpr);
        setSize(saved.width, saved.height, false, saved.top, saved.left);
      } finally {
        captureActive.current = false;
        activeStop.current = null;
        invalidate();
      }
    };
    const prepare = (width: number, height: number, exposure: number) => {
      if (captureActive.current) throw new Error('Já existe uma captura da árvore em andamento.');
      captureActive.current = true;
      if (orbitControls && typeof orbitControls.enabled === 'boolean') orbitControls.enabled = false;
      const frame = storyCameraFrame(0, width / height, CAMERA_CONFIG.FOV);
      camera.position.set(...frame.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(...frame.target);
      camera.fov = CAMERA_CONFIG.FOV;
      camera.zoom = 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      gl.toneMappingExposure = exposure;
      setDpr(1);
      setSize(width, height, false, 0, 0);
    };
    const capture: StoryFrameCapture = async () => {
      if (captureActive.current) throw new Error('Já existe uma captura da árvore em andamento.');
      return withTemporaryCaptureState<StoryCaptureSnapshot, HTMLCanvasElement>(
        snapshot,
        () => prepare(STORY_SCENE_WIDTH, STORY_SCENE_HEIGHT, 1.1),
        async () => {
          await nextRenderedFrame();
          await nextRenderedFrame();
          const source = gl.domElement;
          if (source.width <= 0 || source.height <= 0) throw new Error('A renderização vertical não produziu uma imagem válida.');
          const output = document.createElement('canvas');
          output.width = STORY_SCENE_WIDTH;
          output.height = STORY_SCENE_HEIGHT;
          const context = output.getContext('2d');
          if (!context) throw new Error('O navegador não conseguiu copiar a captura vertical.');
          context.drawImage(source, 0, 0, output.width, output.height);
          return output;
        },
        restore,
      );
    };

    const startVideo: StoryVideoSceneCapture = async (options) => {
      if (captureActive.current) throw new Error('Já existe uma captura da árvore em andamento.');
      const saved = snapshot();
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        restore(saved);
      };
      try {
        prepare(options.width, options.height, 1.22);
        videoAnimation.current = {
          startedAt: performance.now(),
          durationMs: STORY_VIDEO_DURATION_MS,
          reducedMotion: options.reducedMotion,
        };
        activeStop.current = stop;
        await nextRenderedFrame();
        await nextRenderedFrame();
        return { canvas: gl.domElement, stop };
      } catch (error) {
        stop();
        throw error;
      }
    };

    onReady?.(capture);
    onVideoReady?.(startVideo);
    return () => {
      activeStop.current?.();
      onReady?.(null);
      onVideoReady?.(null);
    };
  }, [camera, captureActive, controls, getState, gl, invalidate, onReady, onVideoReady, setDpr, setSize]);

  return null;
};

// Component to handle dynamic effects
const PostProcessingEffects: React.FC<{
  zoomLevel: ZoomLevel;
  focusedPhoto: PhotoData | null;
}> = ({ zoomLevel, focusedPhoto }) => {
  const dofRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (dofRef.current) {
      // Dynamic Focus Logic
      // If zoomed in, focus on the photo. If full tree, focus on center of tree.
      const targetVec = new THREE.Vector3();

      if (zoomLevel === ZoomLevel.ZOOMED_IN && focusedPhoto) {
        targetVec.set(...focusedPhoto.position);
      } else {
        targetVec.copy(CAMERA_CONFIG.LOOK_AT_OFFSET);
      }

      // Smoothly interpolate the focus target
      dofRef.current.target = targetVec;
    }
  });

  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {/*
         Selective Bloom:
         Only pixels with luminance > 1.0 will bloom.
         We achieve "selective" bloom by setting emissiveIntensity > 1 on lights/stars.
      */}
      <Bloom
        luminanceThreshold={1.2} // High threshold to only catch bright lights
        mipmapBlur
        intensity={1.5}
        radius={0.6}
        levels={9}
      />

      {/*
        Cinematic Depth of Field (Bokeh)
        Only apply strong bokeh when zoomed in to specific photos.
        When viewing the full tree, reduce bokeh significantly or keep it minimal for a sharp view.
      */}
      <DepthOfField
        ref={dofRef}
        target={[0, 0, 0]} // Updated in useFrame
        focalLength={0.02}
        bokehScale={zoomLevel === ZoomLevel.ZOOMED_IN ? 6 : 0} // 0 means sharp in full view
      />

      {/* Vignette for cinematic focus */}
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
    </EffectComposer>
  );
};

const Scene: React.FC<SceneProps> = ({
  photos,
  onPhotoClick,
  controlMode,
  zoomLevel,
  panOffset,
  focusedPhoto,
  isExploded = false,
  isRecording = false,
  recordingType = null,
  userName = '',
  ornaments,
  newOrnamentId,
  onOrnamentSelect,
  premiumGifts,
  onPremiumGiftSelect,
  onStoryCaptureReady,
  onStoryVideoCaptureReady,
  progressionEffects,
  isProgressionCelebrating = false,
  reducedMotion,
  paused = false,
}) => {
  const captureActive = useRef(false);
  const [ambientQuality, setAmbientQuality] = useState<AmbientQuality>(() => getInitialAmbientQuality({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  }));

  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, 2]}
      camera={{ position: CAMERA_CONFIG.DEFAULT_POS, fov: CAMERA_CONFIG.FOV }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: COLORS.BACKGROUND, position: 'relative', zIndex: 0 }}
    >
      <color attach="background" args={[COLORS.BACKGROUND]} />
      <fog attach="fog" args={[COLORS.BACKGROUND, 55, 115]} />
      <PerformanceMonitor
        flipflops={3}
        onIncline={() => setAmbientQuality('full')}
        onDecline={() => setAmbientQuality('reduced')}
        onFallback={() => setAmbientQuality('off')}
      />
      <AdaptiveDpr pixelated />
      <CameraController
        zoomLevel={zoomLevel}
        controlMode={controlMode}
        panOffset={panOffset}
        focusedPhoto={focusedPhoto}
        isRecording={isRecording}
        recordingType={recordingType}
        photos={photos}
        captureActive={captureActive}
        reducedMotion={reducedMotion}
      />
      <StoryCaptureController captureActive={captureActive} onReady={onStoryCaptureReady} onVideoReady={onStoryVideoCaptureReady} />

      {/* Procedural environment preserves reflective lighting without a runtime CDN asset. */}
      <Environment resolution={256} background={false}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} position={[0, 5, -9]} scale={5} color="#fff1a1" />
          <Lightformer form="rect" intensity={2} position={[-7, 1, 3]} scale={[4, 8, 1]} color="#d8e8ff" />
          <Lightformer form="rect" intensity={2} position={[7, -1, 2]} scale={[3, 6, 1]} color="#ffd8c4" />
        </group>
      </Environment>

      {/* Lighting Setup */}
      <ambientLight intensity={0.1 + progressionEffects.lightBoost * 0.08} />
      {/* Warm Main Light */}
      <pointLight position={[20, 10, 20]} intensity={1 + progressionEffects.lightBoost} color="#ffaa00" distance={50} decay={2} />
      {/* Cool Fill Light */}
      <pointLight position={[-20, 5, -20]} intensity={0.5} color="#0055ff" distance={50} decay={2} />
      {/* Rim Light for shape definition */}
      <spotLight position={[0, 30, 0]} intensity={1} angle={0.5} penumbra={1} color="#ffffff" />

      <Stars radius={100} depth={50} count={3000 + Math.round(progressionEffects.atmosphereBoost * 400)} factor={4} saturation={0} fade speed={1 + progressionEffects.atmosphereBoost * 0.15} />
      <AmbientNight
        quality={ambientQuality}
        reducedMotion={reducedMotion}
        recording={isRecording}
        captureActive={captureActive}
      />

      {/* Global Snow Effect */}
      <Snow isExploded={isExploded} atmosphereBoost={progressionEffects.atmosphereBoost} />

      {/* 3D Scene Elements */}
      <group position={[0, TREE_OFFSET_Y, 0]}>
        <TreeMesh isExploded={isExploded} photos={photos} />
        <SpiralDecor isExploded={isExploded} photos={photos} lightBoost={progressionEffects.lightBoost} celebrating={isProgressionCelebrating} />
        <Star isExploded={isExploded} glowBoost={progressionEffects.starGlowBoost} celebrating={isProgressionCelebrating} />
        {!(isRecording && recordingType === 'ALBUM') && <Presents isExploded={isExploded} specialGiftCount={progressionEffects.specialGiftCount} premiumGifts={premiumGifts} onPremiumGiftSelect={onPremiumGiftSelect} />}

        {/* Magic Flies / Sparkles around the tree */}
        <Sparkles
          position={[0, -3, 0]}
          count={160 + progressionEffects.goldenParticleCount}
          scale={[12, 10, 12]}
          size={2}
          speed={0.2 + progressionEffects.atmosphereBoost * 0.08}
          opacity={0.8}
          color="#fff1a1"
          material-toneMapped={false}
        />

        {isProgressionCelebrating && (
          <Sparkles position={[0, 0, 0]} count={48} scale={[13, 16, 13]} size={3} speed={0.65} opacity={0.9} color="#fff1a1" material-toneMapped={false} />
        )}

        {progressionEffects.fullyEnchanted && <pointLight position={[0, 3, 7]} intensity={0.45} color="#fff1a1" distance={18} decay={2} />}

        {photos.map((photo) => (
          <Polaroid
            key={photo.id}
            data={photo}
            onPhotoClick={onPhotoClick}
            isExploded={isExploded}
          />
        ))}
        {ornaments.map((ornament) => (
          <SocialOrnament
            key={ornament.public_id}
            ornament={ornament}
            isNew={ornament.public_id === newOrnamentId}
            onSelect={onOrnamentSelect}
          />
        ))}
      </group>

      <SceneEffects
        zoomLevel={zoomLevel}
        focusedPhoto={focusedPhoto}
        isRecording={isRecording}
        recordingType={recordingType}
        photos={photos}
        progressionGlow={progressionEffects.starGlowBoost}
      />
    </Canvas>
  );
};

export default Scene;

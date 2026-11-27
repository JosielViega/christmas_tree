import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Lightformer, Sparkles, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import TreeMesh from './TreeMesh';
import SpiralDecor from './SpiralDecor';
import Polaroid from './Polaroid';
import Star from './Star';
import Presents from './Presents';
import Snow from './Snow';
import SocialOrnament from './SocialOrnament';
import AmbientNight from './AmbientNight';
import { CAMERA_CONFIG, COLORS, GESTURE_THRESHOLDS, TREE_CONFIG } from '../constants';
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
import type { AmbientQuality } from '../utils/ambientEffects';
import { storyCameraFrame } from '../utils/videoFraming';
import { markStartup, measureStartup } from '../utils/startup';
import { PREMIUM_GIFT_FOCUS_DISTANCE } from '../utils/premiumGiftLayout';
import {
  ADAPTIVE_INITIAL_STABILIZATION_MS,
  ADAPTIVE_TRANSITION_STABILIZATION_MS,
  advanceAdaptivePerformanceState,
  createAdaptivePerformanceState,
  getInitialPerformanceQuality,
  getPerformanceBudget,
  getPerformanceDpr,
  getTreeParticleCount,
} from '../utils/performance';
import type { PerformanceQuality } from '../utils/performance';
import {
  DEFAULT_DIAGNOSTIC_SETTINGS,
  PerformanceDiagnosticsPanel,
  PerformanceProbe,
} from './PerformanceDiagnostics';
import type { DiagnosticSettings, PerformanceMetrics } from './PerformanceDiagnostics';

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
  essentialReady: boolean;
  onStartupEvent?: (event: 'webgl_ready' | 'scene_prepared' | 'first_frame' | 'ready' | 'error') => void;
}

const TREE_OFFSET_Y = -2;

class SceneErrorBoundary extends React.Component<{ onError?: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error('3D scene initialization failed', { type: error.name });
    this.props.onError?.();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

const SceneReadiness: React.FC<{ enabled: boolean; onEvent?: SceneProps['onStartupEvent'] }> = ({ enabled, onEvent }) => {
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
    if (enabled) {
      markStartup('materials_ready');
      measureStartup('scene-materials', 'geometry_ready', 'materials_ready');
      onEvent?.('scene_prepared');
    }
  }, [enabled, onEvent]);
  useFrame(() => {
    if (!enabled || frames.current >= 2) return;
    frames.current++;
    if (frames.current === 1) onEvent?.('first_frame');
    if (frames.current === 2) onEvent?.('ready');
  });
  return null;
};

const SceneEffects: React.FC<{
  zoomLevel: ZoomLevel;
  focusedPhoto: PhotoData | null;
  isRecording: boolean;
  recordingType: 'FULL' | 'ALBUM' | null;
  photos: PhotoData[];
  progressionGlow: number;
  quality: 'full' | 'reduced' | 'off';
}> = ({ progressionGlow, quality }) => {
  if (quality === 'off') return null;
  return (
    <EffectComposer disableNormalPass multisampling={quality === 'full' ? 4 : 0}>
      <Bloom
        intensity={(quality === 'full' ? 0.5 : 0.32) + progressionGlow * 0.12}
        luminanceThreshold={quality === 'full' ? 0.9 : 1.05}
        luminanceSmoothing={0.9}
        mipmapBlur={quality === 'full'}
      />

      <Vignette eskil={false} offset={0.1} darkness={quality === 'full' ? 1.1 : 0.85} />
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
          const targetRadius = focusedPhoto.id.startsWith('premium-gift-') ? PREMIUM_GIFT_FOCUS_DISTANCE : 6;

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

const StoryCaptureFillLights: React.FC<{
  captureActive: React.MutableRefObject<boolean>;
}> = ({ captureActive }) => {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (group.current) group.current.visible = captureActive.current;
  });

  return (
    <group ref={group} visible={false}>
      <pointLight position={[-14, 4, 10]} intensity={0.42} color="#fff1c7" distance={55} decay={2} />
      <pointLight position={[12, 3, -12]} intensity={0.38} color="#d9e8ff" distance={55} decay={2} />
    </group>
  );
};

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
  const captureDimensions = useRef<{ width: number; height: number } | null>(null);
  const activeStop = useRef<(() => void) | null>(null);

  useFrame(() => {
    const dimensions = captureDimensions.current;
    if (dimensions && camera instanceof THREE.PerspectiveCamera) {
      const aspect = dimensions.width / dimensions.height;
      const currentSize = getState().size;
      if (currentSize.width !== dimensions.width || currentSize.height !== dimensions.height) {
        setSize(dimensions.width, dimensions.height, false, 0, 0);
      }
      if (gl.domElement.width !== dimensions.width || gl.domElement.height !== dimensions.height) {
        gl.setSize(dimensions.width, dimensions.height, false);
      }
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
    }
    const animation = videoAnimation.current;
    if (!animation || !(camera instanceof THREE.PerspectiveCamera)) return;
    const progress = Math.min(1, (performance.now() - animation.startedAt) / animation.durationMs);
    const frame = storyCameraFrame(progress, captureDimensions.current
      ? captureDimensions.current.width / captureDimensions.current.height
      : camera.aspect, camera.fov, animation.reducedMotion);
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
        captureDimensions.current = null;
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
      captureDimensions.current = { width, height };
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
  essentialReady,
  onStartupEvent,
}) => {
  const captureActive = useRef(false);
  const capabilities = useMemo(() => ({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }), []);
  const initialQuality = useMemo(() => getInitialPerformanceQuality(capabilities), [capabilities]);
  const [adaptiveQuality, setAdaptiveQuality] = useState<PerformanceQuality>(initialQuality);
  const adaptiveState = useRef(createAdaptivePerformanceState(initialQuality));
  const adaptiveMonitoringStarted = useRef(false);
  const [adaptiveMonitorReady, setAdaptiveMonitorReady] = useState(false);
  const [diagnosticSettings, setDiagnosticSettings] = useState<DiagnosticSettings>(DEFAULT_DIAGNOSTIC_SETTINGS);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const diagnosticsEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('perf') === '1';
  const activeQuality = diagnosticsEnabled && diagnosticSettings.quality !== 'auto'
    ? diagnosticSettings.quality
    : adaptiveQuality;
  const performanceBudget = getPerformanceBudget(activeQuality);
  const activeDpr = getPerformanceDpr(activeQuality, window.devicePixelRatio, diagnosticsEnabled && diagnosticSettings.reducedDpr);
  const treeParticleCount = getTreeParticleCount(activeQuality, TREE_CONFIG.PARTICLE_COUNT);
  const ambientQuality: AmbientQuality = activeQuality === 'high' ? 'full' : activeQuality === 'balanced' ? 'reduced' : 'off';
  const effectsEnabled = !diagnosticsEnabled || diagnosticSettings.effects;
  const dynamicLightsEnabled = !diagnosticsEnabled || diagnosticSettings.dynamicLights;
  const automaticOrnamentsEnabled = !diagnosticsEnabled || diagnosticSettings.automaticOrnaments;
  const giftsAndPhotosEnabled = !diagnosticsEnabled || diagnosticSettings.giftsAndPhotos;
  const animationsEnabled = !reducedMotion && (!diagnosticsEnabled || diagnosticSettings.animations);

  useEffect(() => {
    setAdaptiveMonitorReady(false);
    adaptiveState.current = advanceAdaptivePerformanceState(adaptiveState.current, 'reset', initialQuality);
    if (!essentialReady || paused || isRecording || diagnosticsEnabled) return;

    let timer: number | undefined;
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      setAdaptiveMonitorReady(false);
      adaptiveState.current = advanceAdaptivePerformanceState(adaptiveState.current, 'reset', initialQuality);
      if (document.visibilityState !== 'visible') return;
      timer = window.setTimeout(() => {
        adaptiveMonitoringStarted.current = true;
        setAdaptiveMonitorReady(true);
      }, delay);
    };
    const handleVisibilityChange = () => {
      schedule(ADAPTIVE_TRANSITION_STABILIZATION_MS);
    };

    schedule(adaptiveMonitoringStarted.current
      ? ADAPTIVE_TRANSITION_STABILIZATION_MS
      : ADAPTIVE_INITIAL_STABILIZATION_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [adaptiveQuality, diagnosticsEnabled, essentialReady, initialQuality, isRecording, paused]);

  const handleDecline = () => {
    const next = advanceAdaptivePerformanceState(adaptiveState.current, 'decline', initialQuality);
    adaptiveState.current = next;
    setAdaptiveQuality(next.quality);
  };
  const handleIncline = () => {
    const next = advanceAdaptivePerformanceState(adaptiveState.current, 'incline', initialQuality);
    adaptiveState.current = next;
    setAdaptiveQuality(next.quality);
  };

  return (
    <>
    <SceneErrorBoundary onError={() => onStartupEvent?.('error')}>
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={activeDpr}
      camera={{ position: CAMERA_CONFIG.DEFAULT_POS, fov: CAMERA_CONFIG.FOV }}
      gl={{
        antialias: getPerformanceBudget(initialQuality).antialias,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: COLORS.BACKGROUND, position: 'relative', zIndex: 0 }}
      onCreated={({ gl }) => {
        onStartupEvent?.('webgl_ready');
        const canvas = gl.domElement;
        const lost = (event: Event) => { event.preventDefault(); onStartupEvent?.('error'); };
        canvas.addEventListener('webglcontextlost', lost, { once: true });
      }}
    >
      <SceneReadiness enabled={essentialReady} onEvent={onStartupEvent} />
      <color attach="background" args={[COLORS.BACKGROUND]} />
      <fog attach="fog" args={[COLORS.BACKGROUND, 55, 115]} />
      <PerformanceProbe enabled={diagnosticsEnabled} onMetrics={setPerformanceMetrics} />
      {adaptiveMonitorReady && <PerformanceMonitor
        key={adaptiveQuality}
        iterations={12}
        ms={500}
        threshold={0.8}
        onIncline={handleIncline}
        onDecline={handleDecline}
      />}
      {!diagnosticsEnabled && !isRecording && <AdaptiveDpr pixelated />}
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
      <StoryCaptureFillLights captureActive={captureActive} />

      {/* Procedural environment preserves reflective lighting without a runtime CDN asset. */}
      <Environment resolution={performanceBudget.environmentResolution} background={false}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} position={[0, 5, -9]} scale={5} color="#fff1a1" />
          <Lightformer form="rect" intensity={2} position={[-7, 1, 3]} scale={[4, 8, 1]} color="#d8e8ff" />
          <Lightformer form="rect" intensity={2} position={[7, -1, 2]} scale={[3, 6, 1]} color="#ffd8c4" />
        </group>
      </Environment>

      {/* Lighting Setup */}
      <ambientLight intensity={0.1 + progressionEffects.lightBoost * 0.08} />
      {dynamicLightsEnabled && <>
        <pointLight position={[20, 10, 20]} intensity={1 + progressionEffects.lightBoost} color="#ffaa00" distance={50} decay={2} />
        <pointLight position={[-20, 5, -20]} intensity={0.5} color="#0055ff" distance={50} decay={2} />
        {activeQuality !== 'economy' && <spotLight position={[0, 30, 0]} intensity={1} angle={0.5} penumbra={1} color="#ffffff" />}
      </>}

      {effectsEnabled && <Stars radius={100} depth={50} count={performanceBudget.starCount + Math.round(progressionEffects.atmosphereBoost * 200 * performanceBudget.sparkleScale)} factor={4} saturation={0} fade speed={animationsEnabled ? 1 + progressionEffects.atmosphereBoost * 0.15 : 0} />}
      {effectsEnabled && <AmbientNight
        quality={ambientQuality}
        reducedMotion={!animationsEnabled}
        recording={isRecording}
        captureActive={captureActive}
      />}

      {/* Global Snow Effect */}
      {effectsEnabled && <Snow isExploded={isExploded} atmosphereBoost={progressionEffects.atmosphereBoost} count={performanceBudget.snowCount} animationsEnabled={animationsEnabled} />}

      {/* 3D Scene Elements */}
      <group position={[0, TREE_OFFSET_Y, 0]}>
        <TreeMesh isExploded={isExploded} photos={photos} particleCount={treeParticleCount} leafDetail={performanceBudget.leafDetail} animationsEnabled={animationsEnabled} />
        <SpiralDecor isExploded={isExploded} photos={photos} lightBoost={progressionEffects.lightBoost} celebrating={isProgressionCelebrating} reducedMotion={!animationsEnabled} particleScale={performanceBudget.sparkleScale} showSpiral={effectsEnabled} showAutomaticOrnaments={automaticOrnamentsEnabled} dynamicLights={dynamicLightsEnabled} animationsEnabled={animationsEnabled} />
        <Star isExploded={isExploded} glowBoost={progressionEffects.starGlowBoost} celebrating={isProgressionCelebrating} sparkleScale={effectsEnabled ? performanceBudget.sparkleScale : 0} animationsEnabled={animationsEnabled} />
        {giftsAndPhotosEnabled && !(isRecording && recordingType === 'ALBUM') && <Presents isExploded={isExploded} specialGiftCount={progressionEffects.specialGiftCount} premiumGifts={premiumGifts} onPremiumGiftSelect={onPremiumGiftSelect} animationsEnabled={animationsEnabled} />}

        {/* Magic Flies / Sparkles around the tree */}
        {effectsEnabled && <Sparkles
          position={[0, -3, 0]}
          count={Math.max(24, Math.round((160 + progressionEffects.goldenParticleCount) * performanceBudget.sparkleScale))}
          scale={[12, 10, 12]}
          size={2}
          speed={animationsEnabled ? 0.2 + progressionEffects.atmosphereBoost * 0.08 : 0}
          opacity={0.8}
          color="#fff1a1"
          material-toneMapped={false}
        />}

        {effectsEnabled && isProgressionCelebrating && (
          <Sparkles position={[0, 0, 0]} count={Math.max(12, Math.round(48 * performanceBudget.sparkleScale))} scale={[13, 16, 13]} size={3} speed={animationsEnabled ? 0.65 : 0} opacity={0.9} color="#fff1a1" material-toneMapped={false} />
        )}

        {dynamicLightsEnabled && progressionEffects.fullyEnchanted && <pointLight position={[0, 3, 7]} intensity={0.45} color="#fff1a1" distance={18} decay={2} />}

        {giftsAndPhotosEnabled && photos.map((photo) => (
          <Polaroid
            key={photo.id}
            data={photo}
            onPhotoClick={onPhotoClick}
            isExploded={isExploded}
            animationsEnabled={animationsEnabled}
          />
        ))}
        {ornaments.map((ornament) => (
          <SocialOrnament
            key={ornament.public_id}
            ornament={ornament}
            isNew={ornament.public_id === newOrnamentId}
            onSelect={onOrnamentSelect}
            animationsEnabled={animationsEnabled}
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
        quality={effectsEnabled ? performanceBudget.postProcessing : 'off'}
      />
    </Canvas>
    </SceneErrorBoundary>
    {diagnosticsEnabled && <PerformanceDiagnosticsPanel metrics={performanceMetrics} settings={diagnosticSettings} activeQuality={activeQuality} onChange={setDiagnosticSettings} />}
    </>
  );
};

export default Scene;

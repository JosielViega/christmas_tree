import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ADAPTIVE_REQUIRED_STREAK,
  advanceAdaptivePerformanceState,
  createAdaptivePerformanceState,
  degradePerformanceQuality,
  getInitialPerformanceQuality,
  getPerformanceBudget,
  getPerformanceDpr,
  getSceneAmbientLightIntensity,
  getTreeParticleCount,
  improvePerformanceQuality,
  summarizeFrameTimes,
} from '../utils/performance.ts';

test('performance policy uses capability and rendered-pixel workload instead of user-agent detection', () => {
  assert.equal(getInitialPerformanceQuality({ hardwareConcurrency: 12, deviceMemory: 16, devicePixelRatio: 1, viewportWidth: 1920, viewportHeight: 1080 }), 'high');
  assert.equal(getInitialPerformanceQuality({ hardwareConcurrency: 12, deviceMemory: 16, devicePixelRatio: 2, viewportWidth: 2560, viewportHeight: 1440 }), 'high');
  assert.equal(getInitialPerformanceQuality({ hardwareConcurrency: 8, deviceMemory: 8, devicePixelRatio: 3, viewportWidth: 390, viewportHeight: 844 }), 'balanced');
  assert.equal(getInitialPerformanceQuality({ hardwareConcurrency: 4, deviceMemory: 4, devicePixelRatio: 2, viewportWidth: 390, viewportHeight: 844 }), 'economy');
});

test('scene budgets progressively reduce expensive GPU work while preserving the high profile', () => {
  assert.deepEqual(getPerformanceDpr('high', 3), [1, 1.75]);
  assert.deepEqual(getPerformanceDpr('balanced', 3), [1, 1.5]);
  assert.deepEqual(getPerformanceDpr('economy', 3), [1, 1]);
  assert.deepEqual(getPerformanceDpr('high', 3, true), [1, 1]);
  assert.equal(getTreeParticleCount('high', 20_000), 20_000);
  assert.equal(getTreeParticleCount('balanced', 20_000), 8_000);
  assert.equal(getTreeParticleCount('economy', 20_000), 5_000);
  assert.equal(getPerformanceBudget('high').leafDetail, 'full');
  assert.equal(getPerformanceBudget('balanced').leafDetail, 'reduced');
  assert.equal(getPerformanceBudget('high').postProcessing, 'full');
  assert.equal(getPerformanceBudget('balanced').postProcessing, 'off');
  assert.equal(getPerformanceBudget('economy').postProcessing, 'off');
  assert.equal(getPerformanceBudget('high').antialias, true);
  assert.equal(getPerformanceBudget('balanced').antialias, false);
  assert.equal(getPerformanceBudget('economy').antialias, false);
});

test('balanced lighting lifts leaf definition without changing high or economy profiles', () => {
  assert.equal(getSceneAmbientLightIntensity('high'), 0.1);
  assert.equal(getSceneAmbientLightIntensity('balanced'), 0.115);
  assert.equal(getSceneAmbientLightIntensity('economy'), 0.1);
  assert.equal(getSceneAmbientLightIntensity('balanced', 1), 0.195);
});

test('representative Android mobile and desktop-site viewports explain the observed density and sharpness tradeoff', () => {
  const hardware = { hardwareConcurrency: 8, deviceMemory: 8, devicePixelRatio: 2.625 };
  const mobile = { ...hardware, viewportWidth: 412, viewportHeight: 915 };
  const desktopSite = { ...hardware, viewportWidth: 980, viewportHeight: 1_740 };

  assert.equal(getInitialPerformanceQuality(mobile), 'balanced');
  assert.equal(getInitialPerformanceQuality(desktopSite), 'economy');
  assert.equal(getTreeParticleCount('balanced', 20_000), 8_000);
  assert.equal(getTreeParticleCount('economy', 20_000), 5_000);

  const mobileDpr = getPerformanceDpr('balanced', mobile.devicePixelRatio)[1];
  const desktopSiteDpr = getPerformanceDpr('economy', desktopSite.devicePixelRatio)[1];
  assert.equal(Math.round(mobile.viewportWidth * mobileDpr), 618);
  assert.equal(Math.round(desktopSite.viewportWidth * desktopSiteDpr), 980);
});

test('mobile quality uses one deterministic DPR policy and avoids a second pixelated scaler', () => {
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(scene, /AdaptiveDpr/);
  assert.doesNotMatch(scene, /pixelated/);
});

test('quality transitions are bounded and require callers to supply the recovery ceiling', () => {
  assert.equal(degradePerformanceQuality('high'), 'balanced');
  assert.equal(degradePerformanceQuality('balanced'), 'economy');
  assert.equal(degradePerformanceQuality('economy'), 'economy');
  assert.equal(improvePerformanceQuality('economy', 'balanced'), 'balanced');
  assert.equal(improvePerformanceQuality('balanced', 'balanced'), 'balanced');
});

test('adaptive quality requires sustained signals and never recovers above its initial ceiling', () => {
  assert.equal(ADAPTIVE_REQUIRED_STREAK, 2);
  let state = createAdaptivePerformanceState('high');
  state = advanceAdaptivePerformanceState(state, 'decline', 'high');
  assert.equal(state.quality, 'high');
  assert.equal(state.declineStreak, 1);
  state = advanceAdaptivePerformanceState(state, 'incline', 'high');
  assert.equal(state.quality, 'high');
  assert.equal(state.declineStreak, 0);
  state = advanceAdaptivePerformanceState(state, 'decline', 'high');
  state = advanceAdaptivePerformanceState(state, 'decline', 'high');
  assert.equal(state.quality, 'balanced');
  state = advanceAdaptivePerformanceState(state, 'incline', 'high');
  state = advanceAdaptivePerformanceState(state, 'incline', 'high');
  assert.equal(state.quality, 'high');
  state = advanceAdaptivePerformanceState(state, 'incline', 'high');
  state = advanceAdaptivePerformanceState(state, 'incline', 'high');
  assert.equal(state.quality, 'high');
});

test('scene delays and resets adaptive sampling around startup, transitions and hidden tabs', () => {
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
  assert.match(scene, /ADAPTIVE_INITIAL_STABILIZATION_MS/);
  assert.match(scene, /ADAPTIVE_TRANSITION_STABILIZATION_MS/);
  assert.match(scene, /document\.visibilityState !== 'visible'/);
  assert.match(scene, /addEventListener\('visibilitychange'/);
  assert.match(scene, /iterations=\{12\}/);
  assert.match(scene, /ms=\{500\}/);
  assert.doesNotMatch(scene, /onFallback=/);
  assert.doesNotMatch(scene, /activeQuality !== 'economy'.*animations/i);
});

test('procedural transparent particles discard their rectangular backing pixels', () => {
  const snow = readFileSync(new URL('../components/Snow.tsx', import.meta.url), 'utf8');
  const spiral = readFileSync(new URL('../components/SpiralDecor.tsx', import.meta.url), 'utf8');
  const star = readFileSync(new URL('../components/Star.tsx', import.meta.url), 'utf8');
  for (const [name, source] of [['Snow', snow], ['SpiralDecor', spiral], ['Star', star]] as const) {
    assert.match(source, /discard;/, name);
  }
  assert.match(snow, /gl_PointCoord/);
  assert.match(spiral, /gl_PointCoord/);
  assert.match(star, /radius >= 1\.0/);
  assert.doesNotMatch(snow, /CanvasTexture|uTexture/);
  assert.doesNotMatch(spiral, /fluffTexture/);
  assert.doesNotMatch(star, /GlowTexture|CanvasTexture/);
});

test('frame summaries report averages and slow-frame percentiles without inventing samples', () => {
  const summary = summarizeFrameTimes([10, 20, 30, 40, 50]);
  assert.equal(Math.round(summary.averageFps), 33);
  assert.equal(summary.minimumFps, 20);
  assert.equal(summary.p50FrameMs, 30);
  assert.equal(summary.p95FrameMs, 50);
  assert.equal(summary.p99FrameMs, 50);
  assert.deepEqual(summarizeFrameTimes([]), { averageFps: 0, minimumFps: 0, averageFrameMs: 0, p50FrameMs: 0, p95FrameMs: 0, p99FrameMs: 0 });
});

test('diagnostics remain explicitly activated and development-only', () => {
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
  const diagnostics = readFileSync(new URL('../components/PerformanceDiagnostics.tsx', import.meta.url), 'utf8');
  assert.match(scene, /import\.meta\.env\.DEV.*get\('perf'\) === '1'/);
  assert.match(scene, /PerformanceProbe enabled=\{diagnosticsEnabled\}/);
  assert.match(diagnostics, /drawCalls/);
  assert.match(diagnostics, /p95FrameMs/);
  assert.doesNotMatch(diagnostics, /cookie|csrf|recovery|message/i);
});

test('generated GPU resources have explicit disposal paths', () => {
  for (const component of ['TreeMesh', 'SpiralDecor', 'Snow', 'Star']) {
    const source = readFileSync(new URL(`../components/${component}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /\.dispose\(\)/, component);
  }
});

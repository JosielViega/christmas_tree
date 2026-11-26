import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  degradePerformanceQuality,
  getInitialPerformanceQuality,
  getPerformanceBudget,
  getPerformanceDpr,
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
  assert.deepEqual(getPerformanceDpr('balanced', 3), [1, 1.25]);
  assert.deepEqual(getPerformanceDpr('economy', 3), [1, 1]);
  assert.deepEqual(getPerformanceDpr('high', 3, true), [1, 1]);
  assert.equal(getTreeParticleCount('high', 20_000), 20_000);
  assert.equal(getTreeParticleCount('balanced', 20_000), 8_000);
  assert.equal(getTreeParticleCount('economy', 20_000), 5_000);
  assert.equal(getPerformanceBudget('high').leafDetail, 'full');
  assert.equal(getPerformanceBudget('balanced').leafDetail, 'reduced');
  assert.equal(getPerformanceBudget('economy').postProcessing, 'off');
});

test('quality transitions are bounded and require callers to supply the recovery ceiling', () => {
  assert.equal(degradePerformanceQuality('high'), 'balanced');
  assert.equal(degradePerformanceQuality('balanced'), 'economy');
  assert.equal(degradePerformanceQuality('economy'), 'economy');
  assert.equal(improvePerformanceQuality('economy', 'balanced'), 'balanced');
  assert.equal(improvePerformanceQuality('balanced', 'balanced'), 'balanced');
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

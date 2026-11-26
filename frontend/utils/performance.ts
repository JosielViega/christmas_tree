export type PerformanceQuality = 'high' | 'balanced' | 'economy';
export type LeafDetail = 'full' | 'reduced' | 'flat';
export type PostProcessingQuality = 'full' | 'reduced' | 'off';

export interface PerformanceCapabilities {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  devicePixelRatio?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ScenePerformanceBudget {
  maxDpr: number;
  treeParticleScale: number;
  leafDetail: LeafDetail;
  starCount: number;
  snowCount: number;
  sparkleScale: number;
  environmentResolution: 64 | 128 | 256;
  postProcessing: PostProcessingQuality;
  antialias: boolean;
}

export const SCENE_PERFORMANCE_BUDGETS: Record<PerformanceQuality, ScenePerformanceBudget> = {
  high: {
    maxDpr: 1.75,
    treeParticleScale: 1,
    leafDetail: 'full',
    starCount: 3_000,
    snowCount: 1_200,
    sparkleScale: 1,
    environmentResolution: 256,
    postProcessing: 'full',
    antialias: true,
  },
  balanced: {
    maxDpr: 1.25,
    treeParticleScale: 0.4,
    leafDetail: 'reduced',
    starCount: 1_200,
    snowCount: 600,
    sparkleScale: 0.55,
    environmentResolution: 128,
    postProcessing: 'reduced',
    antialias: false,
  },
  economy: {
    maxDpr: 1,
    treeParticleScale: 0.25,
    leafDetail: 'flat',
    starCount: 600,
    snowCount: 300,
    sparkleScale: 0.3,
    environmentResolution: 64,
    postProcessing: 'off',
    antialias: false,
  },
};

const qualityOrder: PerformanceQuality[] = ['economy', 'balanced', 'high'];

export const pixelWorkload = ({
  devicePixelRatio = 1,
  viewportWidth = 0,
  viewportHeight = 0,
}: PerformanceCapabilities): number => viewportWidth * viewportHeight * devicePixelRatio * devicePixelRatio;

export const getInitialPerformanceQuality = (capabilities: PerformanceCapabilities): PerformanceQuality => {
  const cores = capabilities.hardwareConcurrency ?? 8;
  const memory = capabilities.deviceMemory ?? 8;
  const dpr = capabilities.devicePixelRatio ?? 1;
  const workload = pixelWorkload(capabilities);
  const wideCapableViewport = (capabilities.viewportWidth ?? 0) >= 1_024 && cores >= 8 && memory >= 8;

  if (cores <= 4 || memory <= 4) return 'economy';
  if (wideCapableViewport) return 'high';
  if (workload >= 4_000_000) return 'economy';
  if (cores <= 6 || memory <= 6 || workload >= 2_500_000 || dpr >= 2.5) return 'balanced';
  return 'high';
};

export const getPerformanceBudget = (quality: PerformanceQuality): ScenePerformanceBudget => (
  SCENE_PERFORMANCE_BUDGETS[quality]
);

export const getPerformanceDpr = (
  quality: PerformanceQuality,
  devicePixelRatio = 1,
  diagnosticReduction = false,
): [number, number] => {
  const ceiling = Math.min(devicePixelRatio, SCENE_PERFORMANCE_BUDGETS[quality].maxDpr);
  return [1, diagnosticReduction ? 1 : Math.max(1, ceiling)];
};

export const getTreeParticleCount = (quality: PerformanceQuality, fullCount: number): number => (
  Math.max(3_000, Math.round(fullCount * SCENE_PERFORMANCE_BUDGETS[quality].treeParticleScale))
);

export const degradePerformanceQuality = (quality: PerformanceQuality): PerformanceQuality => (
  qualityOrder[Math.max(0, qualityOrder.indexOf(quality) - 1)]
);

export const improvePerformanceQuality = (
  quality: PerformanceQuality,
  ceiling: PerformanceQuality,
): PerformanceQuality => {
  const next = Math.min(qualityOrder.indexOf(ceiling), qualityOrder.indexOf(quality) + 1);
  return qualityOrder[Math.max(0, next)];
};

export interface FrameSummary {
  averageFps: number;
  minimumFps: number;
  averageFrameMs: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
}

const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
};

export const summarizeFrameTimes = (frameTimes: readonly number[]): FrameSummary => {
  const valid = frameTimes.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) {
    return { averageFps: 0, minimumFps: 0, averageFrameMs: 0, p50FrameMs: 0, p95FrameMs: 0, p99FrameMs: 0 };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const averageFrameMs = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const maximumFrameMs = sorted[sorted.length - 1];
  return {
    averageFps: 1_000 / averageFrameMs,
    minimumFps: 1_000 / maximumFrameMs,
    averageFrameMs,
    p50FrameMs: percentile(sorted, 0.5),
    p95FrameMs: percentile(sorted, 0.95),
    p99FrameMs: percentile(sorted, 0.99),
  };
};

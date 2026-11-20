export type AmbientQuality = 'full' | 'reduced' | 'off';

export interface DelayRange {
  minMs: number;
  maxMs: number;
}

export interface AmbientScheduleConfig {
  initialDelay: DelayRange;
  recurringDelay: DelayRange;
  durationMs: number;
}

export interface AmbientScheduleState {
  phase: 'waiting' | 'active';
  remainingMs: number;
  progress: number;
}

export type AmbientScheduleTransition = 'none' | 'started' | 'finished';

export const SANTA_SCHEDULE: AmbientScheduleConfig = {
  initialDelay: { minMs: 15_000, maxMs: 25_000 },
  recurringDelay: { minMs: 45_000, maxMs: 90_000 },
  durationMs: 9_500,
};

export const SHOOTING_STAR_SCHEDULE: AmbientScheduleConfig = {
  initialDelay: { minMs: 8_000, maxMs: 16_000 },
  recurringDelay: { minMs: 18_000, maxMs: 36_000 },
  durationMs: 1_600,
};

export const AMBIENT_LIMITS = {
  santaTrailParticles: { full: 18, reduced: 8, off: 0 },
  simultaneousSantas: 1,
  simultaneousShootingStars: 1,
} as const;

const normalizedRandom = (random: () => number): number => Math.min(0.999999, Math.max(0, random()));

export const randomDelay = (range: DelayRange, random: () => number = Math.random): number => {
  const min = Math.max(0, Math.min(range.minMs, range.maxMs));
  const max = Math.max(min, Math.max(range.minMs, range.maxMs));
  return min + normalizedRandom(random) * (max - min);
};

export const createAmbientSchedule = (
  config: AmbientScheduleConfig,
  random: () => number = Math.random,
): AmbientScheduleState => ({
  phase: 'waiting',
  remainingMs: randomDelay(config.initialDelay, random),
  progress: 0,
});

export const resetAmbientSchedule = (
  state: AmbientScheduleState,
  config: AmbientScheduleConfig,
  random: () => number = Math.random,
): void => {
  state.phase = 'waiting';
  state.remainingMs = randomDelay(config.initialDelay, random);
  state.progress = 0;
};

export const advanceAmbientSchedule = (
  state: AmbientScheduleState,
  elapsedMs: number,
  enabled: boolean,
  config: AmbientScheduleConfig,
  random: () => number = Math.random,
): AmbientScheduleTransition => {
  if (!enabled || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 'none';
  const step = Math.min(elapsedMs, 1_000);
  state.remainingMs -= step;

  if (state.remainingMs > 0) {
    if (state.phase === 'active') state.progress = Math.min(1, 1 - state.remainingMs / config.durationMs);
    return 'none';
  }

  if (state.phase === 'waiting') {
    state.phase = 'active';
    state.remainingMs = config.durationMs;
    state.progress = 0;
    return 'started';
  }

  state.phase = 'waiting';
  state.remainingMs = randomDelay(config.recurringDelay, random);
  state.progress = 0;
  return 'finished';
};

export interface AmbientPolicyInput {
  reducedMotion: boolean;
  captureActive: boolean;
  recording: boolean;
  quality: AmbientQuality;
}

export const getAmbientPolicy = ({ reducedMotion, captureActive, recording, quality }: AmbientPolicyInput) => ({
  animate: !reducedMotion && !captureActive && !recording && quality !== 'off',
  trailParticleCount: AMBIENT_LIMITS.santaTrailParticles[quality],
  shootingStarsEnabled: quality !== 'off',
});

export const getInitialAmbientQuality = (capabilities: { hardwareConcurrency?: number; deviceMemory?: number }): AmbientQuality => {
  if ((capabilities.hardwareConcurrency ?? 8) <= 4 || (capabilities.deviceMemory ?? 8) <= 4) return 'reduced';
  return 'full';
};

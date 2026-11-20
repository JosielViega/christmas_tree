export interface TreeProgressionEffects {
  lightBoost: number;
  goldenParticleCount: number;
  specialGiftCount: number;
  starGlowBoost: number;
  atmosphereBoost: number;
  fullyEnchanted: boolean;
}

export interface TreeProgressionStage {
  level: number;
  threshold: number;
  name: string;
  effects: TreeProgressionEffects;
}

export const TREE_PROGRESSION_STAGES: readonly TreeProgressionStage[] = [
  { level: 0, threshold: 0, name: 'Árvore original', effects: { lightBoost: 0, goldenParticleCount: 0, specialGiftCount: 0, starGlowBoost: 0, atmosphereBoost: 0, fullyEnchanted: false } },
  { level: 1, threshold: 5, name: 'Luzes acolhedoras', effects: { lightBoost: 0.12, goldenParticleCount: 0, specialGiftCount: 0, starGlowBoost: 0, atmosphereBoost: 0, fullyEnchanted: false } },
  { level: 2, threshold: 10, name: 'Partículas douradas', effects: { lightBoost: 0.16, goldenParticleCount: 36, specialGiftCount: 0, starGlowBoost: 0, atmosphereBoost: 0, fullyEnchanted: false } },
  { level: 3, threshold: 20, name: 'Presentes especiais', effects: { lightBoost: 0.2, goldenParticleCount: 48, specialGiftCount: 2, starGlowBoost: 0, atmosphereBoost: 0, fullyEnchanted: false } },
  { level: 4, threshold: 35, name: 'Estrela radiante', effects: { lightBoost: 0.23, goldenParticleCount: 58, specialGiftCount: 2, starGlowBoost: 0.45, atmosphereBoost: 0, fullyEnchanted: false } },
  { level: 5, threshold: 50, name: 'Atmosfera natalina', effects: { lightBoost: 0.27, goldenParticleCount: 72, specialGiftCount: 3, starGlowBoost: 0.6, atmosphereBoost: 0.4, fullyEnchanted: false } },
  { level: 6, threshold: 60, name: 'Árvore encantada', effects: { lightBoost: 0.32, goldenParticleCount: 96, specialGiftCount: 4, starGlowBoost: 0.8, atmosphereBoost: 0.7, fullyEnchanted: true } },
] as const;

export interface TreeProgression {
  ornamentCount: number;
  stage: TreeProgressionStage;
  nextStage: TreeProgressionStage | null;
  remaining: number;
  progressToNext: number;
}

export type ProgressionUpdateSource = 'initial-load' | 'persisted-addition' | 'deletion';

export const getTreeProgression = (ornamentCount: number): TreeProgression => {
  const normalizedCount = Math.max(0, Math.floor(Number.isFinite(ornamentCount) ? ornamentCount : 0));
  let stageIndex = 0;
  for (let index = 1; index < TREE_PROGRESSION_STAGES.length; index++) {
    if (normalizedCount < TREE_PROGRESSION_STAGES[index].threshold) break;
    stageIndex = index;
  }

  const stage = TREE_PROGRESSION_STAGES[stageIndex];
  const nextStage = TREE_PROGRESSION_STAGES[stageIndex + 1] ?? null;
  const remaining = nextStage ? Math.max(0, nextStage.threshold - normalizedCount) : 0;
  const progressToNext = nextStage
    ? Math.min(1, (normalizedCount - stage.threshold) / (nextStage.threshold - stage.threshold))
    : 1;
  return { ornamentCount: normalizedCount, stage, nextStage, remaining, progressToNext };
};

export const getTreeProgressionFromOrnaments = (ornaments: readonly { public_id: string }[]): TreeProgression => {
  return getTreeProgression(ornaments.length);
};

export const getUnlockedProgressionStage = (
  previousCount: number,
  nextCount: number,
  source: ProgressionUpdateSource,
): TreeProgressionStage | null => {
  if (source !== 'persisted-addition' || nextCount <= previousCount) return null;
  const previous = getTreeProgression(previousCount).stage;
  const next = getTreeProgression(nextCount).stage;
  return next.level > previous.level ? next : null;
};

export const shouldAnimateProgressionUnlock = (stage: TreeProgressionStage | null, reducedMotion: boolean): boolean => {
  return Boolean(stage && !reducedMotion);
};

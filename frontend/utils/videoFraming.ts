export interface StoryCameraFrame {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
}

export const STORY_SCENE_BOUNDS = {
  halfWidth: 8.6,
  halfHeight: 7.8,
  centerY: -2,
} as const;

const smoothStep = (value: number): number => {
  const bounded = Math.min(1, Math.max(0, value));
  return bounded * bounded * (3 - 2 * bounded);
};

export const perspectiveDistanceForBounds = (
  fovDegrees: number,
  aspect: number,
  halfWidth: number,
  halfHeight: number,
  padding = 1.08,
): number => {
  if (![fovDegrees, aspect, halfWidth, halfHeight, padding].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid story framing dimensions.');
  }
  const verticalHalfFov = fovDegrees * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  return Math.max(
    halfWidth * padding / Math.tan(horizontalHalfFov),
    halfHeight * padding / Math.tan(verticalHalfFov),
  );
};

export const storyCameraFrame = (
  elapsedProgress: number,
  aspect: number,
  fovDegrees: number,
  reducedMotion = false,
): StoryCameraFrame => {
  const progress = Math.min(1, Math.max(0, elapsedProgress));
  const fullDistance = perspectiveDistanceForBounds(
    fovDegrees,
    aspect,
    STORY_SCENE_BOUNDS.halfWidth,
    STORY_SCENE_BOUNDS.halfHeight,
  );
  if (reducedMotion || progress <= 0.25) {
    return { position: [0, STORY_SCENE_BOUNDS.centerY, fullDistance], target: [0, STORY_SCENE_BOUNDS.centerY, 0], distance: fullDistance };
  }

  const transition = smoothStep((progress - 0.25) / 0.375);
  const finalPhase = smoothStep((progress - 0.625) / 0.375);
  const distance = fullDistance * (1 - transition * 0.075);
  const x = 2.4 * transition - 1.2 * finalPhase;
  const y = STORY_SCENE_BOUNDS.centerY + 0.35 * transition;
  const z = Math.sqrt(Math.max(1, distance * distance - x * x));
  return { position: [x, y, z], target: [0, STORY_SCENE_BOUNDS.centerY - 0.1, 0], distance };
};

export const boundsFitPerspective = (distance: number, fovDegrees: number, aspect: number): boolean => {
  const verticalHalfFov = fovDegrees * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  return STORY_SCENE_BOUNDS.halfHeight <= Math.tan(verticalHalfFov) * distance
    && STORY_SCENE_BOUNDS.halfWidth <= Math.tan(horizontalHalfFov) * distance;
};

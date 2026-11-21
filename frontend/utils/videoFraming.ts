export interface StoryCameraFrame {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
  angleRadians: number;
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
  if (reducedMotion) {
    return {
      position: [0, STORY_SCENE_BOUNDS.centerY, fullDistance],
      target: [0, STORY_SCENE_BOUNDS.centerY, 0],
      distance: fullDistance,
      angleRadians: 0,
    };
  }

  // Complete the orbit by seven seconds, then keep the frontal composition
  // stable for the final second. The sinusoidal term eases the angular speed
  // at both ends without changing direction or introducing a cut.
  const orbitProgress = Math.min(1, progress / 0.875);
  const orbitFraction = orbitProgress - Math.sin(orbitProgress * Math.PI * 2) / (Math.PI * 2);
  const angleRadians = orbitFraction * Math.PI * 2;

  // Between two and six seconds, approach the tree only as far as the full
  // scene bounds allow. Return to the wide composition while completing the
  // orbit from six to seven seconds.
  const minimumSafeDistance = perspectiveDistanceForBounds(
    fovDegrees,
    aspect,
    STORY_SCENE_BOUNDS.halfWidth,
    STORY_SCENE_BOUNDS.halfHeight,
    1.02,
  );
  const zoomIn = smoothStep((progress - 0.25) / 0.5);
  const zoomOut = smoothStep((progress - 0.75) / 0.125);
  const distance = fullDistance - (fullDistance - minimumSafeDistance) * zoomIn * (1 - zoomOut);
  const height = STORY_SCENE_BOUNDS.centerY + Math.sin(orbitProgress * Math.PI) * 0.22;

  return {
    position: [Math.sin(angleRadians) * distance, height, Math.cos(angleRadians) * distance],
    target: [0, STORY_SCENE_BOUNDS.centerY, 0],
    distance,
    angleRadians,
  };
};

export const boundsFitPerspective = (distance: number, fovDegrees: number, aspect: number): boolean => {
  const verticalHalfFov = fovDegrees * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  return STORY_SCENE_BOUNDS.halfHeight <= Math.tan(verticalHalfFov) * distance
    && STORY_SCENE_BOUNDS.halfWidth <= Math.tan(horizontalHalfFov) * distance;
};

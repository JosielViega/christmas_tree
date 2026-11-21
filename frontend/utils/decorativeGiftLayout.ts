export const DECORATIVE_GIFT_COUNT = 12;

export interface DecorativeGiftTransform {
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export const getDecorativeGiftTransforms = (): DecorativeGiftTransform[] => Array.from(
  { length: DECORATIVE_GIFT_COUNT },
  (_, index) => {
    const angle = index * Math.PI * 2 / DECORATIVE_GIFT_COUNT + 0.14;
    const radius = 8.25 + (index % 3) * 0.28;
    return {
      position: [Math.cos(angle) * radius, -6.86, Math.sin(angle) * radius],
      rotationY: angle + Math.PI / 2,
      scale: 0.62 + (index % 4) * 0.07,
    };
  },
);

export const horizontalGiftDistance = (left: readonly number[], right: readonly number[]): number =>
  Math.hypot(left[0] - right[0], left[2] - right[2]);

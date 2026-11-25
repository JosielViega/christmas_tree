export const PREMIUM_GIFT_LAYOUT_VERSION = 2 as const;
export const PREMIUM_GIFT_VISIBLE_LIMIT = 12;
export const PREMIUM_GIFT_SCALE = 1.2;
export const PREMIUM_GIFT_CLEARANCE = 1.95;
export const PREMIUM_GIFT_FOCUS_DISTANCE = 7.2;

export const getPremiumGiftTransform = (positionIndex: number, layoutVersion: number = PREMIUM_GIFT_LAYOUT_VERSION) => {
  if (![1, PREMIUM_GIFT_LAYOUT_VERSION].includes(layoutVersion) || !Number.isInteger(positionIndex) || positionIndex < 0) {
    throw new Error('Invalid premium gift position.');
  }
  const ring = Math.floor(positionIndex / PREMIUM_GIFT_VISIBLE_LIMIT);
  const slot = positionIndex % PREMIUM_GIFT_VISIBLE_LIMIT;
  const angle = (slot / PREMIUM_GIFT_VISIBLE_LIMIT) * Math.PI * 2 + (ring % 2) * Math.PI / PREMIUM_GIFT_VISIBLE_LIMIT;
  const radius = (layoutVersion === 1 ? 4.9 : 7.2) + ring * 1.5;
  return {
    position: [Math.sin(angle) * radius, -6.82, Math.cos(angle) * radius] as [number, number, number],
    rotation: [0, angle, 0] as [number, number, number],
  };
};

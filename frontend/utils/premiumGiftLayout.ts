export const PREMIUM_GIFT_LAYOUT_VERSION = 1 as const;
export const PREMIUM_GIFT_VISIBLE_LIMIT = 12;

export const getPremiumGiftTransform = (positionIndex: number, layoutVersion = PREMIUM_GIFT_LAYOUT_VERSION) => {
  if (layoutVersion !== PREMIUM_GIFT_LAYOUT_VERSION || !Number.isInteger(positionIndex) || positionIndex < 0) {
    throw new Error('Invalid premium gift position.');
  }
  const ring = Math.floor(positionIndex / PREMIUM_GIFT_VISIBLE_LIMIT);
  const slot = positionIndex % PREMIUM_GIFT_VISIBLE_LIMIT;
  const angle = (slot / PREMIUM_GIFT_VISIBLE_LIMIT) * Math.PI * 2 + (ring % 2) * Math.PI / PREMIUM_GIFT_VISIBLE_LIMIT;
  const radius = 4.9 + ring * 1.35;
  return {
    position: [Math.sin(angle) * radius, -6.82, Math.cos(angle) * radius] as [number, number, number],
    rotation: [0, angle, 0] as [number, number, number],
  };
};

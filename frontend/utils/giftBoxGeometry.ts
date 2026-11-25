import { RoundedBoxGeometry } from 'three-stdlib';

export const GIFT_BOX_FACE_NAMES = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;

export const createGiftBoxGeometry = (): RoundedBoxGeometry => new RoundedBoxGeometry(1, 1, 1, 4, 0.02);

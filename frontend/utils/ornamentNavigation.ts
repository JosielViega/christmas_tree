import type { SocialOrnamentData } from '../types';

export type OrnamentNavigationDirection = 'previous' | 'next';

export interface OrnamentNavigationState {
  current: SocialOrnamentData;
  previous: SocialOrnamentData;
  next: SocialOrnamentData;
  index: number;
  total: number;
}

export const orderExistingOrnaments = (ornaments: readonly SocialOrnamentData[]): SocialOrnamentData[] =>
  [...ornaments].sort((first, second) =>
    first.slot_index - second.slot_index || first.public_id.localeCompare(second.public_id),
  );

export const getOrnamentNavigation = (
  orderedOrnaments: readonly SocialOrnamentData[],
  selectedPublicId: string | null,
): OrnamentNavigationState | null => {
  if (!selectedPublicId || orderedOrnaments.length === 0) return null;
  const index = orderedOrnaments.findIndex((ornament) => ornament.public_id === selectedPublicId);
  if (index < 0) return null;

  return {
    current: orderedOrnaments[index],
    previous: orderedOrnaments[(index - 1 + orderedOrnaments.length) % orderedOrnaments.length],
    next: orderedOrnaments[(index + 1) % orderedOrnaments.length],
    index,
    total: orderedOrnaments.length,
  };
};

export const isEditableNavigationTarget = (target: EventTarget | null): boolean => {
  const element = target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return element.isContentEditable === true
    || tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || Boolean(element.closest?.('[contenteditable="true"]'));
};

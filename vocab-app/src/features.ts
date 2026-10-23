import type { CardType } from './types';

/** Features switched on per build phase. */
export const ENABLED_FEATURES = {
  stats: true,
  reading: true,
  audio: true,
  themes: true,
};

/** Card types the scheduler may ask, in rising difficulty. */
export const ENABLED_CARD_TYPES: CardType[] = [1, 2, 3, 4, 5];

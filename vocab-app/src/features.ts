import type { CardType } from './types';

/** Features switched on per build phase. */
export const ENABLED_FEATURES = {
  stats: false,
  reading: false,
  audio: false,
  themes: false,
  writing: false,
};

/** Card types the scheduler may ask. Types 4–5 arrive in phase 2. */
export const ENABLED_CARD_TYPES: CardType[] = [1, 2, 3];

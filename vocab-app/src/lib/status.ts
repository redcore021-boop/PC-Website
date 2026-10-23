import type { Progress } from '../types';
import { State } from './srs';

export type WordStatus = 'new' | 'learning' | 'known' | 'mastered';

export function statusOf(p?: Progress): WordStatus {
  if (!p) return 'new';
  if (p.mastered) return 'mastered';
  if (p.card.state === State.Review && p.level >= 3) return 'known';
  return 'learning';
}

export const STATUS_LABEL: Record<WordStatus, string> = {
  new: 'Not started',
  learning: 'Learning',
  known: 'Can produce',
  mastered: 'Mastered',
};

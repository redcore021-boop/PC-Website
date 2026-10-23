import type { WordEntry } from '../types';
import type { AnswerOutcome } from '../lib/srs';

/** Card type 5 (phase 2). */
export function WriteSentence(_props: {
  word: WordEntry;
  result: unknown;
  onAnswer: (o: AnswerOutcome, given?: string) => void;
  kind: React.ReactNode;
}) {
  return null;
}

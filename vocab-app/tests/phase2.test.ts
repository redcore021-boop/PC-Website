import { describe, expect, it } from 'vitest';
import { usesWord } from '../src/lib/usage';
import { buildWeakQueue, weakestProgress } from '../src/lib/session';
import { applyAnswer, availableTypes, newProgress } from '../src/lib/srs';
import { builtInWords } from '../src/lib/words';
import type { CardType } from '../src/types';

const w = (word: string) => builtInWords.find((x) => x.word === word)!;
const ALL: CardType[] = [1, 2, 3, 4, 5];

describe('sentence check (card 5)', () => {
  it('recognises inflections and family forms', () => {
    expect(usesWord('We mitigated the damage quickly.', w('mitigate'))).toBe(true);
    expect(usesWord('Mitigation is expensive.', w('mitigate'))).toBe(true);
    expect(usesWord('Phones are everywhere now.', w('ubiquitous'))).toBe(false);
    expect(usesWord('The ubiquity of phones is new.', w('ubiquitous'))).toBe(true);
  });
  it('handles phrasal verbs and idioms with words in between', () => {
    expect(usesWord('My boss kept buttering me up all week.', w('butter up'))).toBe(true);
    expect(usesWord('She buried the hatchet with her brother.', w('bury the hatchet'))).toBe(true);
    expect(usesWord('I took his promises with a grain of salt.', w('take with a grain of salt'))).toBe(true);
    expect(usesWord('I took it seriously.', w('take with a grain of salt'))).toBe(false);
  });
});

describe('card availability', () => {
  it('skips precision cards for words without precision data', () => {
    expect(availableTypes(ALL, false)).toEqual([1, 2, 3, 5]);
    expect(availableTypes(ALL, true)).toEqual(ALL);
  });
  it('production successes on any of types 3–5 count towards mastery', () => {
    let p = newProgress('x');
    let t = new Date('2026-01-01T10:00:00');
    for (const type of [1, 2, 3, 4, 5] as CardType[]) {
      p = applyAnswer(p, type, { correct: true }, ALL, t);
      t = new Date(p.card.due);
    }
    expect(p.level).toBe(3);
    expect(p.production).toBe(3);
  });
});

describe('weak-word practice', () => {
  const now = new Date('2026-02-01T12:00:00');
  const make = (id: string, mistakes: number) => {
    const p = applyAnswer(newProgress(id, new Date('2026-01-25T10:00:00')), 1, { correct: true }, ALL, new Date('2026-01-25T10:00:00'));
    return { ...p, mistakes };
  };
  it('orders by mistakes and builds an ungraded queue', () => {
    const progress = [make('mitigate', 1), make('cogent', 5), make('tacit', 0), make('salient', 3)];
    expect(weakestProgress(progress, now).map((p) => p.wordId).slice(0, 3)).toEqual(['cogent', 'salient', 'mitigate']);
    const q = buildWeakQueue(builtInWords, progress, ALL, now);
    expect(q.every((i) => !i.graded && i.kind === 'quiz')).toBe(true);
    expect(q[0].wordId).toBe('cogent');
  });
  it('ignores words never reviewed', () => {
    expect(weakestProgress([newProgress('mitigate')], now)).toEqual([]);
  });
});

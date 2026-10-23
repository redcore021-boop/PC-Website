import { beforeEach, describe, expect, it } from 'vitest';
import { builtInWords, introOrder, wordEffort } from '../src/lib/words';
import { effectiveNewPerDay, buildQueue } from '../src/lib/session';
import { buildQuestion, pickDistractors } from '../src/lib/cards';
import { seeded } from '../src/lib/random';
import { DEFAULT_SETTINGS, daysStudiedBefore, introduceWord, recordAnswer } from '../src/lib/store';
import { db } from '../src/lib/db';

describe('gentle start', () => {
  it('introduces easier words first', () => {
    const order = introOrder(builtInWords);
    const avg = (xs: typeof order) => xs.reduce((s, w) => s + wordEffort(w), 0) / xs.length;
    expect(avg(order.slice(0, 50))).toBeLessThan(avg(order.slice(-50)));
    expect(order.slice(0, 50).every((w) => w.tier === 1)).toBe(true);
    expect(order.slice(-20).some((w) => w.tier === 3)).toBe(true);
    expect(new Set(order.map((w) => w.id)).size).toBe(builtInWords.length);
  });

  it('mixes single words, phrasal verbs and idioms from day one', () => {
    const first10 = introOrder(builtInWords).slice(0, 10).map((w) => w.pos);
    expect(first10.filter((p) => p.includes('phrasal')).length).toBe(2);
    expect(first10.filter((p) => p.includes('idiom')).length).toBe(2);
  });

  it('puts words the learner added before everything else', () => {
    const mine = { ...builtInWords[0], id: 'zzz', word: 'zzz', custom: true, tier: 3 as const };
    expect(introOrder([...builtInWords, mine])[0].id).toBe('zzz');
  });

  it('warms up the number of new words over the first days', () => {
    expect([0, 1, 2, 3, 4].map((d) => effectiveNewPerDay(10, d))).toEqual([5, 7, 9, 10, 10]);
    expect(effectiveNewPerDay(3, 0)).toBe(3);
  });

  it('marks first quizzes as easy', () => {
    const q = buildQueue({ words: builtInWords, progress: [], settings: DEFAULT_SETTINGS, today: { newWords: 0, reviews: 0 }, enabled: [1, 2, 3, 4, 5], mode: 'daily' });
    expect(q.every((i) => i.easy)).toBe(true);
  });

  it('easy questions use wrong options from other areas of meaning', () => {
    const all = builtInWords;
    let shared = { easy: 0, hard: 0 };
    for (const w of all.slice(0, 80)) {
      for (const mode of ['easy', 'hard'] as const) {
        const d = pickDistractors(w, all, 3, seeded(w.id.length), { themeBonus: true, easy: mode === 'easy' });
        shared[mode] += d.filter((x) => x.themes.some((t) => w.themes.includes(t))).length;
      }
    }
    expect(shared.easy).toBeLessThan(shared.hard / 3);
    const q = buildQuestion(all[0], 1, all, seeded(1), true);
    expect(q.type === 1 && q.options.length).toBe(4);
  });
});

describe('progress feedback', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  it('reports when a word moves up a step', async () => {
    await introduceWord('candid');
    expect((await recordAnswer('candid', 1, { correct: true }, true, [1, 2, 3, 4, 5])).levelUp).toBe(true);
    expect((await recordAnswer('candid', 2, { correct: false }, false, [1, 2, 3, 4, 5])).levelUp).toBe(false);
  });
  it('counts earlier study days only', async () => {
    await db.days.bulkPut([
      { day: '2020-01-01', answered: 5, newWords: 0, goalMet: true },
      { day: '2020-01-02', answered: 0, newWords: 0, goalMet: false },
    ]);
    expect(await daysStudiedBefore()).toBe(1);
  });
});

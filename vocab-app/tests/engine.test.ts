import { describe, expect, it } from 'vitest';
import { levenshtein, matchAnswer, normalize } from '../src/lib/fuzzy';
import { alternativeSpellings } from '../src/lib/spelling';
import { applyAnswer, chooseCardType, newProgress, Rating, State } from '../src/lib/srs';
import { buildQueue, requeueAfterMistake } from '../src/lib/session';
import { buildQuestion, maxHints, pickDistractors, typingHint } from '../src/lib/cards';
import { builtInWords, splitGap, plain } from '../src/lib/words';
import { computeStreak, DEFAULT_SETTINGS } from '../src/lib/store';
import { addDays, dayKey } from '../src/lib/dates';
import { seeded } from '../src/lib/random';
import type { CardType, Progress } from '../src/types';

const ENABLED: CardType[] = [1, 2, 3];

describe('fuzzy matching', () => {
  it('counts a transposition as one edit', () => {
    expect(levenshtein('recieve', 'receive')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
  it('accepts exact, small typos, and rejects other words', () => {
    expect(matchAnswer('Ubiquitous', 'ubiquitous')).toBe('exact');
    expect(matchAnswer('ubiquitus', 'ubiquitous')).toBe('typo');
    expect(matchAnswer('ubiqitus', 'ubiquitous')).toBe('typo');
    expect(matchAnswer('omnipresent', 'ubiquitous')).toBe('wrong');
    expect(matchAnswer('wane', 'wade')).toBe('wrong');
    expect(matchAnswer('tacet', 'tacit')).toBe('typo');
    expect(matchAnswer('rife', 'ripe')).toBe('wrong'); // too short for typo tolerance
    expect(matchAnswer('', 'ubiquitous')).toBe('wrong');
  });
  it('ignores placeholders, articles and punctuation in phrases', () => {
    expect(normalize("Keep someone at arm’s length")).toBe("keep at arm's length");
    expect(matchAnswer('keep at arms length', "keep someone at arm's length")).toBe('typo');
    expect(matchAnswer('double edged sword', 'a double-edged sword')).toBe('exact');
    expect(matchAnswer('to mitigate', 'mitigate')).toBe('exact');
  });
  it('accepts British spellings', () => {
    expect(matchAnswer('galvanise', 'galvanize', alternativeSpellings('galvanize'))).toBe('exact');
    expect(matchAnswer('rancour', 'rancor', alternativeSpellings('rancor'))).toBe('exact');
    expect(matchAnswer('meagre', 'meager', alternativeSpellings('meager'))).toBe('exact');
  });
});

describe('scheduling and levels', () => {
  const now = new Date('2026-01-10T10:00:00');
  it('climbs one card type per success and drops after a mistake', () => {
    let p = newProgress('x', now);
    p = applyAnswer(p, 1, { correct: true }, ENABLED, now);
    expect(p.level).toBe(2);
    expect(p.card.state).toBe(State.Review);
    p = applyAnswer(p, 2, { correct: true }, ENABLED, new Date(p.card.due));
    expect(p.level).toBe(3);
    p = applyAnswer(p, 3, { correct: false }, ENABLED, new Date(p.card.due));
    expect(p.level).toBe(2);
    expect(p.mistakes).toBe(1);
  });
  it('a wrong answer schedules a sooner review than a right one', () => {
    const p = applyAnswer(newProgress('x', now), 1, { correct: true }, ENABLED, now);
    const at = new Date(p.card.due);
    const good = applyAnswer(p, 2, { correct: true }, ENABLED, at);
    const bad = applyAnswer(p, 2, { correct: false }, ENABLED, at);
    expect(+new Date(bad.card.due)).toBeLessThan(+new Date(good.card.due));
  });
  it('only counts production successes towards mastery', () => {
    let p = newProgress('x', now);
    let t = now;
    for (let i = 0; i < 8; i++) {
      p = applyAnswer(p, 1, { correct: true }, [1], t);
      t = new Date(p.card.due);
    }
    expect(p.card.stability).toBeGreaterThan(14);
    expect(p.production).toBe(0);
    expect(p.mastered).toBe(false);
  });
  it('becomes mastered after repeated production success with long stability', () => {
    let p = newProgress('x', now);
    let t = now;
    for (const type of [1, 2, 3, 3, 3, 3, 3] as CardType[]) {
      p = applyAnswer(p, type, { correct: true }, ENABLED, t);
      t = new Date(p.card.due);
    }
    expect(p.production).toBeGreaterThanOrEqual(2);
    expect(p.mastered).toBe(true);
  });
  it('typos are graded Hard', () => {
    const p = newProgress('x', now);
    const hard = applyAnswer(p, 3, { correct: true, hard: true }, ENABLED, now);
    const good = applyAnswer(p, 3, { correct: true }, ENABLED, now);
    expect(hard.card.stability).toBeLessThan(good.card.stability);
    expect(Rating.Hard).toBe(2);
  });
  it('picks card types by stage, rotating through production types', () => {
    const p = { ...newProgress('x'), level: 3 as CardType };
    expect(chooseCardType({ ...p, level: 1 }, [1, 2, 3, 4, 5])).toBe(1);
    expect(chooseCardType({ ...p, level: 2 }, [1, 2, 3, 4, 5])).toBe(2);
    // production cards go easiest first: typing, precision, then writing
    const seen = [0, 1, 2, 3].map((production) => chooseCardType({ ...p, production }, [1, 2, 3, 4, 5]));
    expect(seen).toEqual([3, 4, 5, 3]);
    expect(chooseCardType({ ...p, production: 1 }, [1, 2, 3, 5])).toBe(5); // no precision data
    expect(chooseCardType(p, [1, 2, 3])).toBe(3);
  });
  it('a production mistake drops the word back to the gap-fill', () => {
    const p = { ...newProgress('x'), level: 3 as CardType };
    expect(applyAnswer(p, 5, { correct: false }, [1, 2, 3, 4, 5]).level).toBe(2);
    expect(applyAnswer(p, 4, { correct: true }, [1, 2, 3, 4, 5]).level).toBe(3);
  });
});

describe('session queue', () => {
  const words = builtInWords.slice(0, 40);
  const now = new Date('2026-03-01T12:00:00');
  const reviewed = (id: string, dueOffsetDays: number): Progress => {
    const p = applyAnswer(newProgress(id, new Date(+now - 864e6)), 1, { correct: true }, ENABLED, new Date(+now - 864e6));
    return { ...p, card: { ...p.card, due: new Date(+now + dueOffsetDays * 864e5) } };
  };

  it('respects daily limits and gives each new word an intro before its quiz', () => {
    const progress = [reviewed(words[0].id, -1), reviewed(words[1].id, -2), reviewed(words[2].id, 5)];
    const q = buildQueue({
      words, progress, now, settings: { ...DEFAULT_SETTINGS, newPerDay: 4 }, today: { newWords: 1, reviews: 0 },
      enabled: ENABLED, mode: 'daily',
    });
    const intros = q.filter((i) => i.kind === 'intro');
    const reviews = q.filter((i) => i.kind === 'quiz' && !i.isNew);
    expect(intros).toHaveLength(3); // 4 per day minus 1 already learned today
    expect(reviews.map((r) => r.wordId).sort()).toEqual([words[0].id, words[1].id].sort());
    for (const intro of intros) {
      const iIntro = q.indexOf(intro);
      const iQuiz = q.findIndex((x) => x.wordId === intro.wordId && x.kind === 'quiz');
      expect(iQuiz).toBeGreaterThan(iIntro);
    }
    expect(new Set(q.map((x) => x.key)).size).toBe(q.length);
  });

  it('caps reviews and skips suspended words', () => {
    const progress = words.slice(0, 10).map((w) => reviewed(w.id, -1));
    progress[0].suspended = true;
    const q = buildQueue({
      words, progress, now, settings: { ...DEFAULT_SETTINGS, newPerDay: 0, reviewsPerDay: 5 }, today: { newWords: 0, reviews: 2 },
      enabled: ENABLED, mode: 'daily',
    });
    expect(q).toHaveLength(3);
    expect(q.some((i) => i.wordId === words[0].id)).toBe(false);
  });

  it('quick sessions take at most 5 new words', () => {
    const q = buildQueue({ words, progress: [], now, settings: { ...DEFAULT_SETTINGS, newPerDay: 20 }, today: { newWords: 0, reviews: 0 }, enabled: ENABLED, mode: 'quick' });
    expect(q.filter((i) => i.kind === 'intro')).toHaveLength(5);
  });

  it('re-inserts a missed card a few positions later, ungraded, up to 3 times', () => {
    let q = buildQueue({ words, progress: words.slice(0, 12).map((w) => reviewed(w.id, -1)), now, settings: { ...DEFAULT_SETTINGS, newPerDay: 0 }, today: { newWords: 0, reviews: 0 }, enabled: ENABLED, mode: 'daily' });
    const first = q[0];
    q = requeueAfterMistake(q, 0, () => 0);
    expect(q[4].wordId).toBe(first.wordId);
    expect(q[4].graded).toBe(false);
    let idx = 4;
    for (let i = 0; i < 5; i++) {
      const before = q.length;
      q = requeueAfterMistake(q, idx, () => 0);
      if (q.length === before) break;
      idx += 4;
    }
    expect(q.filter((i) => i.wordId === first.wordId)).toHaveLength(4);
  });
});

describe('cards', () => {
  const all = builtInWords;
  const byWord = (w: string) => all.find((x) => x.word === w)!;
  it('never offers a listed synonym as a wrong option', () => {
    const target = byWord('frugal');
    for (let s = 0; s < 30; s++) {
      const d = pickDistractors(target, all, 3, seeded(s));
      expect(d).toHaveLength(3);
      for (const w of d) {
        expect(target.syn.map((x) => x.toLowerCase())).not.toContain(w.word.toLowerCase());
        expect(w.syn.map((x) => x.toLowerCase())).not.toContain('frugal');
      }
    }
  });
  it('builds four distinct options containing the answer', () => {
    for (const w of all) {
      const q = buildQuestion(w, 1, all, seeded(7));
      if (q.type !== 1) throw new Error('expected type 1');
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(w.word);
    }
  });
  it('gap cards hide the target form and keep the rest of the sentence', () => {
    const w = byWord('mitigate');
    const [before, form, after] = splitGap(w.ex[2])!;
    expect(form).toBe('mitigating');
    expect(before + form + after).toBe(plain(w.ex[2]));
  });
  it('precision cards show the inflected answer when the sentence needs it', () => {
    const q = buildQuestion(byWord('juxtapose'), 4, all, seeded(3));
    if (q.type !== 4) throw new Error('expected type 4');
    expect(q.answer).toBe('juxtaposes');
    expect(q.options).toContain('juxtaposes');
  });
  it('typing hint shows only first letters', () => {
    expect(typingHint('mitigate')).toBe('m_______');
    expect(typingHint("keep someone at arm's length")).toBe("k___  s______  a_  a__'_  l_____");
    expect(typingHint('mitigate', 2)).toBe('mit_____');
    expect(typingHint('play down', 3)).toBe('play  d___');
    expect(maxHints('mitigate')).toBe(6);
  });
});

describe('dates and streaks', () => {
  it('rolls the study day over at 4am', () => {
    expect(dayKey(new Date('2026-05-02T02:30:00'))).toBe('2026-05-01');
    expect(dayKey(new Date('2026-05-02T04:30:00'))).toBe('2026-05-02');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('counts consecutive goal days, allowing today to be still open', () => {
    const now = new Date('2026-05-10T12:00:00');
    const d = (day: string, goalMet = true) => ({ day, answered: 10, newWords: 0, goalMet });
    const days = [d('2026-05-06'), d('2026-05-07'), d('2026-05-08'), d('2026-05-09'), d('2026-05-01'), d('2026-05-02'), d('2026-05-03', false)];
    expect(computeStreak(days, now)).toEqual({ current: 4, best: 4, todayDone: false });
    expect(computeStreak([...days, d('2026-05-10')], now).current).toBe(5);
    expect(computeStreak([d('2026-05-07')], now).current).toBe(0);
  });
});

describe('streak week and daily reminder', () => {
  it('lists the last 7 days, oldest first, marking met days and today', async () => {
    const { recentDays } = await import('../src/lib/store');
    const now = new Date(2026, 4, 10, 12);
    const d = (day: string) => ({ day, answered: 5, newWords: 1, goalMet: true });
    const week = recentDays([d('2026-05-10'), d('2026-05-08'), d('2026-05-01')], 7, now);
    expect(week.map((w) => w.day)).toEqual(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10']);
    expect(week.filter((w) => w.met).map((w) => w.day)).toEqual(['2026-05-08', '2026-05-10']);
    expect(week[6].today).toBe(true);
  });

  it('builds a repeating daily calendar event at the chosen time', async () => {
    const { icsText, googleCalendarUrl, firstOccurrence } = await import('../src/lib/reminder');
    const before = new Date(2026, 4, 10, 18, 0);
    const after = new Date(2026, 4, 10, 21, 0);
    expect(firstOccurrence('20:00', before).getDate()).toBe(10);
    expect(firstOccurrence('20:00', after).getDate()).toBe(11);
    const ics = icsText('20:00', 'https://example.com/vocab/', before);
    expect(ics).toContain('DTSTART:20260510T200000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    const g = new URL(googleCalendarUrl('07:30', 'https://example.com/vocab/', after));
    expect(g.searchParams.get('dates')).toBe('20260511T073000/20260511T074000');
    expect(g.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
  });
});

describe('tests and games', () => {
  it('builds a mixed quiz from learned words with one right answer each', async () => {
    const { buildQuiz, gamePool, quizQuestion, pickPairs, trueFalseItem, isBetter } = await import('../src/lib/games');
    const { builtInWords } = await import('../src/lib/words');
    const { newProgress } = await import('../src/lib/srs');
    const { shortHe } = await import('../src/lib/words');
    const all = builtInWords;
    const learned = all.slice(0, 12);
    const progress = learned.map((w) => newProgress(w.id));
    progress[0].suspended = true;
    const pool = gamePool(all, progress);
    expect(pool).toHaveLength(11);
    const rnd = seeded(7);
    const quiz = buildQuiz(pool, all, 10, rnd);
    expect(quiz).toHaveLength(10);
    expect(new Set(quiz.map((q) => q.word.id)).size).toBe(10);
    expect(new Set(quiz.map((q) => q.kind)).size).toBeGreaterThanOrEqual(3);
    for (const q of quiz) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
    }
    for (const w of pool) {
      const m = quizQuestion(w, 'meaning', all, rnd);
      expect(m.answer).toBe(shortHe(w));
      expect(new Set(m.options).size).toBe(4);
    }
    const pairs = pickPairs(pool, 6, rnd);
    expect(new Set(pairs.map((w) => shortHe(w))).size).toBe(pairs.length);
    for (let i = 0; i < 40; i++) {
      const t = trueFalseItem(pool, all, rnd);
      expect(t.isMatch).toBe(t.shown === shortHe(t.word));
    }
    expect(isBetter('match', 30, 40)).toBe(true);
    expect(isBetter('quiz', 70, 80)).toBe(false);
  });
});

describe('pronunciation check', () => {
  it('accepts the word, near misses and the word inside a phrase', async () => {
    const { heardCorrectly } = await import('../src/lib/recognition');
    expect(heardCorrectly(['Mitigate'], 'mitigate')).toBe(true);
    expect(heardCorrectly(['I said mitigate.'], 'mitigate')).toBe(true);
    expect(heardCorrectly(['miss a gate', 'mitigate'], 'mitigate')).toBe(true);
    expect(heardCorrectly(["the ball's in your court", 'the ball is in your court'], 'the ball is in your court')).toBe(true);
    expect(heardCorrectly(['call it a day'], 'call it a day')).toBe(true);
    expect(heardCorrectly(['litigate'], 'mitigate')).toBe(false);
    expect(heardCorrectly(['ubiquitus'], 'ubiquitous')).toBe(true);
    expect(heardCorrectly(['emphasise'], 'emphasize')).toBe(true);
    expect(heardCorrectly(['investigate'], 'mitigate')).toBe(false);
    expect(heardCorrectly(['cat'], 'cot')).toBe(false);
    expect(heardCorrectly([], 'mitigate')).toBe(false);
  });
});

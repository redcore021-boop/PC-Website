import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { introduceWord, recordAnswer, todayCounts, markGoalMet } from '../src/lib/store';
import { createBackup, parseBackup, restoreBackup } from '../src/lib/backup';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('store', () => {
  it('records new words and answers for today', async () => {
    await introduceWord('mitigate');
    await recordAnswer('mitigate', 1, { correct: true }, true, [1, 2, 3]);
    await recordAnswer('mitigate', 1, { correct: false }, false, [1, 2, 3]);
    const t = await todayCounts();
    expect(t.newWords).toBe(1);
    expect(t.answered).toBe(2);
    expect(t.reviews).toBe(0); // a first quiz of a new word is not a "review"
    const p = await db.progress.get('mitigate');
    expect(p!.level).toBe(2);
    expect(p!.mistakes).toBe(1);
  });

  it('round-trips a backup through JSON with dates intact', async () => {
    await introduceWord('cogent');
    await recordAnswer('cogent', 1, { correct: true }, true, [1, 2, 3]);
    await db.customWords.put({ id: 'flibbertigibbet', word: 'flibbertigibbet', ipa: '', pos: 'noun', def: 'a frivolous person', he: '', family: [], ex: [], col: [], reg: 'informal', syn: [], nuance: '', ety: '', tier: 3, themes: [], custom: true });
    await markGoalMet();
    const json = JSON.stringify(await createBackup());

    await Promise.all(db.tables.map((t) => t.clear()));
    expect(await db.progress.count()).toBe(0);

    const r = await restoreBackup(parseBackup(json));
    expect(r.words).toBe(1);
    const p = await db.progress.get('cogent');
    expect(p!.card.due).toBeInstanceOf(Date);
    expect(p!.card.last_review).toBeInstanceOf(Date);
    expect(await db.customWords.count()).toBe(1);
    expect((await db.days.toArray())[0].goalMet).toBe(true);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/JSON תקין/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/לא קובץ גיבוי/);
  });
});

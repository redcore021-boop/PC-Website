import { afterEach, describe, expect, it, vi } from 'vitest';
import { lemmaCandidates } from '../src/lib/lemma';
import { bracketWord, lookupWord, makeCustomWord, parseEntries, LookupError } from '../src/lib/dictionary';
import { db } from '../src/lib/db';
import { buildQuestion } from '../src/lib/cards';
import { builtInWords } from '../src/lib/words';

describe('lemma candidates', () => {
  it('finds base forms of inflections', () => {
    expect(lemmaCandidates('mitigated')).toContain('mitigate');
    expect(lemmaCandidates('mitigating')).toContain('mitigate');
    expect(lemmaCandidates('anomalies')).toContain('anomaly');
    expect(lemmaCandidates('ostracized')).toContain('ostracize');
    expect(lemmaCandidates('ubiquitously')).toContain('ubiquitous');
    expect(lemmaCandidates('dwindling')).toContain('dwindle');
    expect(lemmaCandidates('Abated')).toContain('abate');
    expect(lemmaCandidates('planned')).toContain('plan');
  });
});

describe('dictionary', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.dictCache.clear();
  });

  const entry = (word: string, def: string, extra = {}) => [
    { word, phonetic: `/${word}/`, phonetics: [], meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: def, example: `They ${word} it.` }], synonyms: ['x'] }], ...extra },
  ];

  it('parses senses, IPA and synonyms', () => {
    const p = parseEntries(entry('obviate', 'To anticipate and prevent.') as never);
    expect(p).toMatchObject({ word: 'obviate', ipa: 'obviate', synonyms: ['x'] });
    expect(p.senses[0]).toEqual({ pos: 'verb', def: 'To anticipate and prevent.', example: 'They obviate it.' });
  });

  it('follows inflected forms and caches results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const w = decodeURIComponent(url.split('/').pop()!);
      if (w === 'obviated') return new Response(JSON.stringify(entry('obviated', 'simple past tense and past participle of obviate')));
      if (w === 'obviate') return new Response(JSON.stringify(entry('obviate', 'To anticipate and prevent.')));
      return new Response('[]', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: true });
    const r = await lookupWord('obviated');
    expect(r.word).toBe('obviate');
    await lookupWord('obviated');
    expect(fetchMock).toHaveBeenCalledTimes(2); // second lookup served from IndexedDB
    await expect(lookupWord('zzzqx')).rejects.toBeInstanceOf(LookupError);
  });

  it('reports offline clearly', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(lookupWord('serendipitous')).rejects.toMatchObject({ kind: 'offline' });
  });

  it('marks the target in example sentences for gap cards', () => {
    expect(bracketWord('The fees were obviated by the new law.', 'obviate')).toBe('The fees were [obviated] by the new law.');
    expect(bracketWord('Nothing here.', 'obviate')).toBe('Nothing here.');
  });

  it('builds a learnable custom word', () => {
    const w = makeCustomWord({ word: 'obviate', ipa: 'ˈɑːbvieɪt', pos: 'verb', def: 'To anticipate and prevent.', he: 'למנוע מראש', examples: ['A good plan obviates the need for luck.'], synonyms: [] });
    expect(w).toMatchObject({ id: 'obviate', custom: true, tier: 1, ex: ['A good plan [obviates] the need for luck.'] });
    const q = buildQuestion(w, 2, [...builtInWords, w]);
    expect(q.type).toBe(2);
    const q4 = buildQuestion(w, 4, [...builtInWords, w]);
    expect(q4.type).toBe(3); // no precision data → typed card instead
  });
});

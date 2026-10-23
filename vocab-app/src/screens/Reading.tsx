import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { lemmaCandidates } from '../lib/lemma';
import { bracketWord, lookupWord, LookupError, makeCustomWord, type Lookup } from '../lib/dictionary';
import { familyForms } from '../lib/words';
import { go } from '../lib/router';
import { CloseIcon } from '../components/Icons';
import { HebrewHint } from '../components/WordBits';
import commonJson from '../data/common-words.json';

const COMMON = new Set((commonJson as { words: string[] }).words);
const DRAFT_KEY = 'lexicon-reading-draft';

type Kind = 'new' | 'known' | 'common' | 'name';
interface Token {
  text: string;
  start: number;
  kind?: Kind;
  wordId?: string;
}

const WORD_RE = /[A-Za-z][A-Za-z’'-]*[A-Za-z]|[A-Za-z]/g;

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

function sentenceAround(text: string, at: number): string {
  const before = text.slice(0, at);
  const start = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1;
  const rest = text.slice(at);
  const endRel = rest.search(/[.!?\n]/);
  const end = endRel < 0 ? text.length : at + endRel + 1;
  return text.slice(start, end).trim();
}

export function Reading() {
  const { words } = useApp();
  const [text, setText] = useState(readDraft);
  const [analysed, setAnalysed] = useState(() => readDraft().length > 0);
  const [picked, setPicked] = useState<Token | null>(null);
  const custom = useLiveQuery(() => db.customWords.toArray(), [], []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text);
    } catch {
      /* private mode: the draft just isn't remembered */
    }
  }, [text]);

  // every single-word form the learner already has: words, family forms, added words
  const known = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of words) {
      if (!w.word.includes(' ')) m.set(w.word.toLowerCase(), w.id);
      for (const f of familyForms(w)) if (!f.includes(' ')) m.set(f.toLowerCase(), w.id);
    }
    return m;
  }, [words]);

  const tokens = useMemo(() => {
    const out: Token[] = [];
    let last = 0;
    for (const m of text.matchAll(WORD_RE)) {
      if (m.index! > last) out.push({ text: text.slice(last, m.index), start: last });
      const raw = m[0];
      const cands = lemmaCandidates(raw);
      const hit = cands.map((c) => known.get(c)).find(Boolean);
      const prev = text.slice(0, m.index).trimEnd();
      const sentenceStart = !prev || /[.!?:"“\n]$/.test(prev);
      let kind: Kind;
      if (hit) kind = 'known';
      else if (cands.some((c) => COMMON.has(c)) || raw.length < 3) kind = 'common';
      else if (/^[A-Z]/.test(raw) && !sentenceStart) kind = 'name';
      else kind = 'new';
      out.push({ text: raw, start: m.index!, kind, wordId: hit });
      last = m.index! + raw.length;
    }
    if (last < text.length) out.push({ text: text.slice(last), start: last });
    return out;
  }, [text, known]);

  const newCount = new Set(tokens.filter((t) => t.kind === 'new').map((t) => t.text.toLowerCase())).size;

  return (
    <>
      <header className="topbar">
        <h1>Add from reading</h1>
      </header>

      {!analysed ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Paste an article, an email or a page from a book. Words that aren’t in your list get highlighted — tap one to add it.
          </p>
          <textarea
            className="answer-input"
            style={{ minHeight: 220 }}
            placeholder="Paste English text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Text to read"
          />
          <div className="bottom-actions" style={{ gridTemplateColumns: text ? '1fr 2fr' : '1fr' }}>
            {text && (
              <button className="btn" onClick={() => setText('')}>
                Clear
              </button>
            )}
            <button className="btn primary" disabled={!text.trim()} onClick={() => setAnalysed(true)}>
              Highlight new words
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row wrap small" style={{ gap: 8, marginBottom: 10 }}>
            <span className="tok new legend">new to you</span>
            <span className="tok known legend">in your list</span>
            <span className="spacer" />
            <button className="btn small" onClick={() => setAnalysed(false)}>
              Edit text
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>
            {newCount ? `${newCount} word${newCount === 1 ? '' : 's'} you may not know. Tap any word to look it up.` : 'No unfamiliar words found — tap any word to look it up anyway.'}
          </p>
          <article className="card reading" lang="en">
            {tokens.map((t, i) =>
              t.kind ? (
                <button key={i} type="button" className={'tok ' + t.kind} onClick={() => setPicked(t)}>
                  {t.text}
                </button>
              ) : (
                <span key={i}>{t.text}</span>
              ),
            )}
          </article>
        </>
      )}

      {custom.length > 0 && (
        <>
          <h3 className="section-title">Words you added · {custom.length}</h3>
          <div className="list">
            {custom
              .slice()
              .reverse()
              .map((w) => (
                <div key={w.id} className="list-item">
                  <button className="main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => go('word', w.id)}>
                    <span className="w">{w.word}</span>
                    <span className="d" style={{ display: 'block' }}>
                      {w.def}
                    </span>
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Remove ${w.word}`}
                    onClick={async () => {
                      if (!confirm(`Remove “${w.word}” and its progress?`)) return;
                      await db.transaction('rw', db.customWords, db.progress, async () => {
                        await db.customWords.delete(w.id);
                        await db.progress.delete(w.id);
                      });
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {picked && <WordSheet token={picked} sentence={sentenceAround(text, picked.start)} onClose={() => setPicked(null)} />}
    </>
  );
}

function WordSheet({ token, sentence, onClose }: { token: Token; sentence: string; onClose: () => void }) {
  const { wordById, toast } = useApp();
  const knownWord = token.wordId ? wordById.get(token.wordId) : undefined;
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ok'; data: Lookup } | { status: 'error'; error: string }>({ status: 'loading' });
  const [sense, setSense] = useState(0);
  const [he, setHe] = useState('');
  const [manualDef, setManualDef] = useState('');
  const [useSentence, setUseSentence] = useState(true);

  useEffect(() => {
    if (knownWord) return;
    let alive = true;
    setState({ status: 'loading' });
    lookupWord(token.text)
      .then((data) => alive && setState({ status: 'ok', data }))
      .catch((e) => alive && setState({ status: 'error', error: e instanceof LookupError ? e.message : 'Lookup failed.' }));
    return () => {
      alive = false;
    };
  }, [token.text, knownWord]);

  const headword = state.status === 'ok' ? state.data.word : lemmaCandidates(token.text)[0];
  const already = wordById.get(headword.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

  const save = async () => {
    const chosen = state.status === 'ok' ? state.data.senses[sense] : undefined;
    const def = chosen?.def ?? manualDef.trim();
    if (!def) return;
    const examples = [useSentence ? sentence : '', chosen?.example ?? ''].filter((s) => s && s.length < 400);
    const entry = makeCustomWord({
      word: headword,
      ipa: state.status === 'ok' ? state.data.ipa : '',
      pos: chosen?.pos ?? '',
      def,
      he,
      examples,
      synonyms: state.status === 'ok' ? state.data.synonyms : [],
    });
    await db.customWords.put(entry);
    if (he.trim()) await db.edits.put({ id: entry.id, he: he.trim() });
    toast(`“${entry.word}” added — it will come up among your new words`);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label={`Look up ${token.text}`} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="headword sm" style={{ flex: 1 }}>
            {knownWord?.word ?? headword}
          </h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {knownWord ? (
          <>
            <p className="def">{knownWord.def}</p>
            <HebrewHint text={knownWord.he} resetKey={knownWord.id} />
            <p className="small muted">Already in your list.</p>
            <button className="btn block" onClick={() => go('word', knownWord.id)}>
              Open full entry
            </button>
          </>
        ) : already ? (
          <>
            <p className="def">{already.def}</p>
            <p className="small muted">Already in your list.</p>
            <button className="btn block" onClick={() => go('word', already.id)}>
              Open full entry
            </button>
          </>
        ) : (
          <>
            {state.status === 'loading' && <p className="muted">Looking up…</p>}
            {state.status === 'ok' && (
              <>
                {state.data.ipa && <div className="ipa">/{state.data.ipa}/</div>}
                <div className="field-label">Choose the meaning used in your text</div>
                <div className="stack">
                  {state.data.senses.map((s, i) => (
                    <label key={i} className={'sense' + (i === sense ? ' on' : '')}>
                      <input type="radio" name="sense" checked={i === sense} onChange={() => setSense(i)} />
                      <span>
                        <span className="pos">{s.pos}</span> {s.def}
                        {s.example && <span className="faint small" style={{ display: 'block' }}>“{s.example}”</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {state.status === 'error' && (
              <>
                <p className="feedback typo small" style={{ marginTop: 8 }}>
                  {state.error}
                </p>
                <div className="field-label">Definition</div>
                <textarea className="answer-input" style={{ minHeight: 80 }} value={manualDef} onChange={(e) => setManualDef(e.target.value)} placeholder="What does it mean?" />
              </>
            )}
            {state.status !== 'loading' && (
              <>
                <div className="field-label">Hebrew (optional)</div>
                <input className="answer-input he" dir="rtl" lang="he" style={{ minHeight: 48, fontSize: 17 }} value={he} onChange={(e) => setHe(e.target.value)} placeholder="תרגום" />
                {sentence && (
                  <label className="sense" style={{ marginTop: 12 }}>
                    <input type="checkbox" checked={useSentence} onChange={(e) => setUseSentence(e.target.checked)} />
                    <span className="small">
                      Keep this sentence as an example:
                      <span className="faint" style={{ display: 'block' }}>{bracketWord(sentence, token.text).replace(/\[|\]/g, '')}</span>
                    </span>
                  </label>
                )}
                <button className="btn primary block" style={{ marginTop: 14 }} disabled={state.status === 'error' && !manualDef.trim()} onClick={save}>
                  Add to my words
                </button>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

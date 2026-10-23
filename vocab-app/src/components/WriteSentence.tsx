import { useState } from 'react';
import type { WordEntry } from '../types';
import { Rating, type AnswerOutcome } from '../lib/srs';
import { db } from '../lib/db';
import { usesWord } from '../lib/usage';
import { Example, HebrewHint, WordHeader } from './WordBits';

const RATINGS = [
  { r: Rating.Again, label: 'Again', sub: 'couldn’t' },
  { r: Rating.Hard, label: 'Hard', sub: 'awkward' },
  { r: Rating.Good, label: 'Good', sub: 'natural' },
  { r: Rating.Easy, label: 'Easy', sub: 'effortless' },
] as const;

/**
 * Card type 5: write your own sentence, then compare it with model sentences and rate yourself.
 * No AI involved — the comparison is the learning moment.
 */
export function WriteSentence({
  word,
  result,
  onAnswer,
  kind,
}: {
  word: WordEntry;
  result: unknown;
  onAnswer: (o: AnswerOutcome, given?: string) => void;
  kind: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const missing = submitted && text.trim() && !usesWord(text, word);

  const rate = async (r: (typeof RATINGS)[number]['r']) => {
    if (text.trim()) await db.sentences.add({ wordId: word.id, text: text.trim(), at: Date.now(), rating: r });
    onAnswer({ correct: r !== Rating.Again, selfRating: r }, text.trim());
  };

  return (
    <div style={{ marginTop: 16 }}>
      <section className="card prompt-card">
        {kind}
        <WordHeader word={word} size="sm" />
        <p className="def" style={{ fontSize: 16 }}>
          {word.def}
        </p>
        <HebrewHint text={word.he} resetKey={word.id} />
        <p className="small muted" style={{ marginBottom: 0 }}>
          Write a sentence of your own that uses <strong>{word.word}</strong> naturally — ideally about your life or work.
        </p>
      </section>
      <textarea
        className="answer-input"
        style={{ marginTop: 14 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={submitted}
        placeholder="Your sentence…"
        aria-label="Your sentence"
        autoCapitalize="sentences"
        spellCheck
        autoFocus
      />
      {!submitted ? (
        <div className="bottom-actions" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <button type="button" className="btn" onClick={() => setSubmitted(true)}>
            Skip to examples
          </button>
          <button type="button" className="btn primary" disabled={text.trim().split(/\s+/).length < 3} onClick={() => setSubmitted(true)}>
            Compare
          </button>
        </div>
      ) : (
        !result && (
          <>
            {missing && (
              <p className="feedback typo small" style={{ margin: '12px 0 0' }}>
                Your sentence doesn’t seem to contain “{word.word}” or one of its forms.
              </p>
            )}
            <section className="card" style={{ marginTop: 12 }}>
              <div className="field-label" style={{ marginTop: 0 }}>
                How native speakers use it
              </div>
              <ul className="examples">
                {word.ex.map((e, i) => (
                  <li key={i}>
                    <Example text={e} />
                  </li>
                ))}
              </ul>
              <div className="field-label">Collocations</div>
              <div className="colls">
                {word.col.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
              <p className="note small" style={{ marginTop: 12 }}>
                {word.nuance}
              </p>
            </section>
            <div className="bottom-actions">
              <div className="small muted center">How well did you use it?</div>
              <div className="rate-grid">
                {RATINGS.map(({ r, label, sub }) => (
                  <button key={r} type="button" className={'btn' + (r === Rating.Good ? ' primary' : '')} onClick={() => rate(r)}>
                    {label}
                    <span style={r === Rating.Good ? { color: 'inherit', opacity: 0.75 } : undefined}>{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

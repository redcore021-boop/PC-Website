import { useState } from 'react';
import type { WordEntry } from '../types';
import { Rating, type AnswerOutcome } from '../lib/srs';
import { db } from '../lib/db';
import { usesWord } from '../lib/usage';
import { Example, HebrewMeaning, WordHeader } from './WordBits';
import { allExamples, simpleDef } from '../lib/words';

const RATINGS = [
  { r: Rating.Again, label: 'לא הצלחתי', sub: 'שוב' },
  { r: Rating.Hard, label: 'בקושי', sub: 'מסורבל' },
  { r: Rating.Good, label: 'טוב', sub: 'טבעי' },
  { r: Rating.Easy, label: 'קל', sub: 'בלי מאמץ' },
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
    <div>
      {kind}
      <section className="card prompt-card" dir="ltr" lang="en">
        <WordHeader word={word} size="sm" />
        <HebrewMeaning word={word} />
        <p className="simple" style={{ marginTop: 10, fontSize: 17 }}>
          {simpleDef(word)}
        </p>
      </section>
      <p className="small muted" style={{ margin: '12px 2px 0' }}>
        כתבו משפט משלכם באנגלית שמשתמש במילה באופן טבעי — הכי טוב על החיים או העבודה שלכם.
      </p>
      <textarea
        className="answer-input"
        dir="ltr"
        lang="en"
        style={{ marginTop: 10 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={submitted}
        placeholder="Your sentence…"
        aria-label="המשפט שלך"
        autoCapitalize="sentences"
        spellCheck
        autoFocus
      />
      {!submitted ? (
        <div className="bottom-actions" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <button type="button" className="btn" onClick={() => setSubmitted(true)}>
            לדלג לדוגמאות
          </button>
          <button type="button" className="btn primary" disabled={text.trim().split(/\s+/).length < 3} onClick={() => setSubmitted(true)}>
            להשוות
          </button>
        </div>
      ) : (
        !result && (
          <>
            {missing && (
              <p className="feedback typo small" style={{ margin: '12px 0 0' }}>
                נראה שהמשפט לא כולל את <bdi lang="en">{word.word}</bdi> או צורה שלה.
              </p>
            )}
            <div className="field-label">ככה דוברי אנגלית משתמשים בה</div>
            <section className="card" dir="ltr" lang="en">
              <ul className="examples">
                {allExamples(word).map((e, i) => (
                  <li key={i}>
                    <Example text={e} />
                  </li>
                ))}
              </ul>
              <div className="field-label" dir="rtl" style={{ textAlign: 'left' }}>
                צירופים נפוצים
              </div>
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
              <div className="small muted center">עד כמה הצלחת להשתמש בה?</div>
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

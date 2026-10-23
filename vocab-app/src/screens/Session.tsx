import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WordEntry } from '../types';
import { useApp } from '../state';
import { db } from '../lib/db';
import { buildQueue, QUICK_SESSION_MS, requeueAfterMistake, type QueueItem, type SessionMode } from '../lib/session';
import { buildQuestion, CARD_TYPE_NAMES, type Question } from '../lib/cards';
import { introduceWord, markGoalMet, recordAnswer, todayCounts } from '../lib/store';
import type { AnswerOutcome } from '../lib/srs';
import { matchAnswer } from '../lib/fuzzy';
import { alternativeSpellings } from '../lib/spelling';
import { go } from '../lib/router';
import { ENABLED_CARD_TYPES } from '../features';
import { CloseIcon } from '../components/Icons';
import { WordEntryView } from '../components/WordBits';
import { WriteSentence } from '../components/WriteSentence';

type Mode = SessionMode | 'extra';

interface Result {
  outcome: AnswerOutcome;
  /** What the learner chose or typed */
  given?: string;
}

export function Session({ mode }: { mode: Mode }) {
  const { words, wordById, settings } = useApp();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState({ answered: 0, correct: 0, introduced: 0 });
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  // Build the queue once, from the state of the database when the session opens.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, today] = await Promise.all([db.progress.toArray(), todayCounts()]);
      const s = mode === 'extra' ? { ...settings, newPerDay: today.newWords + 5 } : settings;
      const q = buildQueue({
        words,
        progress,
        settings: s,
        today,
        enabled: ENABLED_CARD_TYPES,
        mode: mode === 'quick' ? 'quick' : 'daily',
      });
      if (alive) setQueue(q);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'quick' || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  const item = queue?.[index];
  const word = item ? wordById.get(item.wordId) : undefined;
  const question = useMemo<Question | null>(
    () => (item && word && item.kind === 'quiz' ? buildQuestion(word, item.cardType, words) : null),
    // a question is built once per queue item so options don't reshuffle on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.key],
  );

  const finish = useCallback(async () => {
    setFinished(true);
    const quickDone = mode === 'quick' && Date.now() - startedAt.current >= QUICK_SESSION_MS * 0.9;
    const queueDone = queue !== null && index >= queue.length - 1;
    if ((queueDone || quickDone) && (queue?.length ?? 0) > 0) await markGoalMet();
  }, [mode, queue, index]);

  const next = useCallback(() => {
    if (!queue) return;
    setResult(null);
    const timeUp = mode === 'quick' && Date.now() - startedAt.current >= QUICK_SESSION_MS;
    if (index + 1 >= queue.length || timeUp) {
      void finish();
      return;
    }
    setIndex(index + 1);
  }, [queue, index, mode, finish]);

  const answer = useCallback(
    (outcome: AnswerOutcome, given?: string) => {
      if (!item || result) return;
      setResult({ outcome, given });
      setTally((t) => ({ ...t, answered: t.answered + 1, correct: t.correct + (outcome.correct ? 1 : 0) }));
      void recordAnswer(item.wordId, item.cardType, outcome, item.graded, ENABLED_CARD_TYPES);
      if (!outcome.correct && queue) setQueue(requeueAfterMistake(queue, index));
    },
    [item, result, queue, index],
  );

  // Enter continues after an answer (handy on a keyboard)
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 250);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [result, next]);

  useEffect(() => {
    if (queue && queue.length === 0) setFinished(true);
  }, [queue]);

  if (!queue) return null;

  const remainingMs = Math.max(0, QUICK_SESSION_MS - (now - startedAt.current));
  const header = (
    <div className="session-top">
      <button className="icon-btn" aria-label="End session" onClick={() => go('')}>
        <CloseIcon />
      </button>
      <div className="progress" aria-label="Session progress">
        <span style={{ width: `${queue.length ? ((index + (result || finished ? 1 : 0)) / queue.length) * 100 : 100}%` }} />
      </div>
      {mode === 'quick' && !finished ? (
        <span className="timer">
          {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}
        </span>
      ) : (
        <span className="timer">
          {Math.min(index + 1, queue.length)}/{queue.length}
        </span>
      )}
    </div>
  );

  if (finished) {
    return (
      <>
        {header}
        <Summary empty={queue.length === 0} tally={tally} />
      </>
    );
  }

  if (!item || !word) {
    // a word was removed since the queue was built
    return (
      <>
        {header}
        <button className="btn block" onClick={next}>
          Skip
        </button>
      </>
    );
  }

  if (item.kind === 'intro') {
    return (
      <>
        {header}
        <div className="prompt-kind" style={{ marginTop: 16 }}>
          New word
        </div>
        <section className="card">
          <WordEntryView word={word} />
        </section>
        <div className="bottom-actions">
          <button
            className="btn primary block"
            onClick={() => {
              // advance immediately; the save is idempotent and its quiz is several cards away
              void introduceWord(word.id);
              setTally((t) => ({ ...t, introduced: t.introduced + 1 }));
              next();
            }}
          >
            Got it — I'll be tested soon
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {question && <QuestionView key={item.key} q={question} result={result} onAnswer={answer} repeat={item.repeat > 0} />}
      {result && (
        <>
          <Feedback q={question!} word={word} result={result} />
          <div className="bottom-actions">
            <button className="btn primary block" onClick={next} autoFocus>
              Continue
            </button>
          </div>
        </>
      )}
    </>
  );
}

function QuestionView({
  q,
  result,
  onAnswer,
  repeat,
}: {
  q: Question;
  result: Result | null;
  onAnswer: (o: AnswerOutcome, given?: string) => void;
  repeat: boolean;
}) {
  const kind = (
    <div className="prompt-kind">
      {CARD_TYPE_NAMES[q.type]}
      {repeat && <span className="faint"> · another try</span>}
    </div>
  );

  switch (q.type) {
    case 1:
      return (
        <div style={{ marginTop: 16 }}>
          <section className="card prompt-card">
            {kind}
            <p className="prompt-text">{q.word.def}</p>
            <p className="pos" style={{ margin: '8px 0 0' }}>
              {q.word.pos}
            </p>
          </section>
          <Choices options={q.options} answer={q.word.word} result={result} onAnswer={onAnswer} />
        </div>
      );
    case 2:
      return (
        <div style={{ marginTop: 16 }}>
          <section className="card prompt-card">
            {kind}
            <p className="gap-sentence">
              {q.before}
              <span className={'blank' + (result ? ' filled' : '')}>{result ? q.form : ' '}</span>
              {q.after}
            </p>
          </section>
          <Choices options={q.options} answer={q.word.word} result={result} onAnswer={onAnswer} />
        </div>
      );
    case 3:
      return <TypeAnswer q={q} result={result} onAnswer={onAnswer} kind={kind} />;
    case 4:
      return (
        <div style={{ marginTop: 16 }}>
          <section className="card prompt-card">
            {kind}
            <p className="small muted" style={{ margin: '0 0 8px' }}>
              Which word fits best?
            </p>
            <p className="gap-sentence">
              {q.before}
              <span className={'blank' + (result ? ' filled' : '')}>{result ? q.answer : ' '}</span>
              {q.after}
            </p>
          </section>
          <Choices options={q.options} answer={q.answer} result={result} onAnswer={onAnswer} />
        </div>
      );
    case 5:
      return <WriteSentence word={q.word} result={result} onAnswer={onAnswer} kind={kind} />;
  }
}

function Choices({
  options,
  answer,
  result,
  onAnswer,
}: {
  options: string[];
  answer: string;
  result: Result | null;
  onAnswer: (o: AnswerOutcome, given?: string) => void;
}) {
  return (
    <div className="options" role="group" aria-label="Options">
      {options.map((o) => {
        let cls = 'option';
        if (result) {
          if (o === answer) cls += ' correct';
          else if (o === result.given) cls += ' wrong';
          else cls += ' dim';
        }
        return (
          <button key={o} className={cls} disabled={!!result} onClick={() => onAnswer({ correct: o === answer }, o)}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TypeAnswer({
  q,
  result,
  onAnswer,
  kind,
}: {
  q: Extract<Question, { type: 3 }>;
  result: Result | null;
  onAnswer: (o: AnswerOutcome, given?: string) => void;
  kind: React.ReactNode;
}) {
  const [value, setValue] = useState('');
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (result || !value.trim()) return;
    const m = matchAnswer(value, q.word.word, alternativeSpellings(q.word.word));
    onAnswer({ correct: m !== 'wrong', hard: m === 'typo' }, value.trim());
  };
  const state = result ? (result.outcome.correct ? ' correct' : ' wrong') : '';
  return (
    <form onSubmit={submit} style={{ marginTop: 16 }}>
      <section className="card prompt-card">
        {kind}
        <p className="prompt-text">{q.word.def}</p>
        <p className="pos" style={{ margin: '8px 0 0' }}>
          {q.word.pos}
        </p>
        <div className="hint" aria-label="Hint: first letters">
          {q.hint}
        </div>
      </section>
      <div style={{ marginTop: 14 }}>
        <input
          className={'answer-input' + state}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type the word…"
          aria-label="Your answer"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          readOnly={!!result}
          autoFocus
        />
      </div>
      {!result && (
        <div className="bottom-actions" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <button type="button" className="btn" onClick={() => onAnswer({ correct: false }, '')}>
            I don't know
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            Check
          </button>
        </div>
      )}
    </form>
  );
}

function Feedback({ q, word, result }: { q: Question; word: WordEntry; result: Result }) {
  const { wordById } = useApp();
  const { outcome, given } = result;
  const typo = outcome.correct && outcome.hard && q.type === 3;
  const cls = typo ? 'typo' : outcome.correct ? 'good' : 'bad';
  // when a wrong option is itself a word in the list, show what it actually means
  const chosen = !outcome.correct && given ? [...wordById.values()].find((w) => w.word === given) : undefined;
  let verdict: string;
  if (q.type === 5) verdict = outcome.correct ? 'Saved — keep using it' : 'Saved — this one needs more practice';
  else if (typo) verdict = `Almost! Check the spelling: ${word.word}`;
  else if (outcome.correct) verdict = 'Correct';
  else if (q.type === 3 && !given) verdict = `The word is “${word.word}”`;
  else verdict = q.type === 4 ? `Best fit: “${q.answer}”` : `Not quite — it's “${word.word}”`;

  return (
    <section className={'feedback ' + cls} aria-live="polite">
      <div className="verdict">{verdict}</div>
      {q.type === 3 && given && !outcome.correct && (
        <div className="small muted">
          You wrote: <s>{given}</s>
        </div>
      )}
      {q.type === 4 && (
        <p className="note" style={{ marginTop: 8 }}>
          {q.why}
        </p>
      )}
      {chosen && chosen.id !== word.id && (
        <p className="note small" style={{ marginTop: 8 }}>
          <strong>{chosen.word}</strong> means: {chosen.def}
        </p>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        <WordEntryView word={word} brief />
      </div>
    </section>
  );
}

function Summary({ empty, tally }: { empty: boolean; tally: { answered: number; correct: number; introduced: number } }) {
  if (empty) {
    return (
      <div className="empty">
        <div className="big-emoji">✓</div>
        <h2>Nothing to study right now</h2>
        <p>No reviews are due and today's new words are done.</p>
        <button className="btn primary" onClick={() => go('')}>
          Back to today
        </button>
      </div>
    );
  }
  const pct = tally.answered ? Math.round((tally.correct / tally.answered) * 100) : 0;
  return (
    <div className="empty">
      <div className="big-emoji">✓</div>
      <h2 style={{ marginBottom: 4 }}>Session complete</h2>
      <p className="muted">Nice work. Spaced repetition does the rest.</p>
      <div className="stat-row" style={{ margin: '20px 0' }}>
        <div className="stat">
          <div className="num">{tally.answered}</div>
          <div className="lbl">answers</div>
        </div>
        <div className="stat">
          <div className="num">{pct}%</div>
          <div className="lbl">correct</div>
        </div>
        <div className="stat">
          <div className="num">{tally.introduced}</div>
          <div className="lbl">new words</div>
        </div>
      </div>
      <button className="btn primary block" onClick={() => go('')}>
        Done
      </button>
    </div>
  );
}


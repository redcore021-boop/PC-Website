import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardType, WordEntry } from '../types';
import { useApp } from '../state';
import { db } from '../lib/db';
import { buildQueue, buildWeakQueue, effectiveNewPerDay, MAX_REPEATS, QUICK_SESSION_MS, requeueAfterMistake, type QueueItem, type SessionMode } from '../lib/session';
import { speak } from '../lib/speech';
import { buildQuestion, maxHints, typingHint, type Question } from '../lib/cards';
import { CARD_TYPE_LABEL } from '../strings';
import { daysStudiedBefore, introduceWord, markGoalMet, recordAnswer, todayCounts } from '../lib/store';
import type { AnswerOutcome } from '../lib/srs';
import { matchAnswer } from '../lib/fuzzy';
import { alternativeSpellings } from '../lib/spelling';
import { go } from '../lib/router';
import { ENABLED_CARD_TYPES, ENABLED_FEATURES } from '../features';
import { CloseIcon } from '../components/Icons';
import { WordEntryView } from '../components/WordBits';
import { WriteSentence } from '../components/WriteSentence';

export type Mode = SessionMode | 'extra' | 'weak';

interface Result {
  outcome: AnswerOutcome;
  /** What the learner chose or typed */
  given?: string;
  /** The card will come back later in this session */
  again?: boolean;
}

/** Shown the first time each card type appears, so every new step is explained. */
const CARD_TYPE_HELP: Record<CardType, string> = {
  1: 'קראו את ההגדרה באנגלית ובחרו את המילה שהיא מתארת.',
  2: 'בחרו את המילה שמשלימה את המשפט האמיתי.',
  3: 'עכשיו מפיקים לבד: הקלידו את המילה לפי ההגדרה. שגיאת כתיב קטנה זה בסדר, ו„רמז” חושף אות.',
  4: 'בחרו את המילה המדויקת ביותר מבין מילים קרובות — ואז קראו למה. שם מסתתר הניואנס.',
  5: 'כתבו משפט משלכם, השוו לדוגמאות של דוברי אנגלית ודרגו את עצמכם בכנות.',
};

/** The question each card asks, shown in Hebrew above the English card. */
const CARD_QUESTION: Record<CardType, string> = {
  1: 'איזו מילה מתאימה להגדרה?',
  2: 'איזו מילה משלימה את המשפט?',
  3: 'הקלידו את המילה',
  4: 'איזו מילה מדויקת יותר כאן?',
  5: 'השתמשו במילה במשפט משלכם',
};

const PRAISE = ['נכון!', 'יפה מאוד!', 'בדיוק!', 'מצוין!', 'כל הכבוד!'];

/** Keep an English word intact inside a Hebrew sentence. */
const En = ({ children }: { children: React.ReactNode }) => (
  <bdi className="en" lang="en" dir="ltr">
    {children}
  </bdi>
);

export function Session({ mode }: { mode: Mode }) {
  const { words, wordById, settings } = useApp();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState({ answered: 0, correct: 0, introduced: 0, movedUp: 0 });
  const [seenTypes, setSeenTypes] = useState<CardType[] | null>(null);
  const startedAt = useRef(Date.now());
  const autoplay = ENABLED_FEATURES.audio && settings.autoplayAudio;
  const [now, setNow] = useState(Date.now());

  // Build the queue once, from the state of the database when the session opens.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [progress, today, studied, seen] = await Promise.all([
        db.progress.toArray(),
        todayCounts(),
        daysStudiedBefore(),
        db.kv.get('seenCardTypes'),
      ]);
      if (alive) setSeenTypes((seen?.value as CardType[] | undefined) ?? []);
      if (mode === 'weak') {
        if (alive) setQueue(buildWeakQueue(words, progress, ENABLED_CARD_TYPES));
        return;
      }
      const s =
        mode === 'extra'
          ? { ...settings, newPerDay: today.newWords + 5 }
          : { ...settings, newPerDay: effectiveNewPerDay(settings.newPerDay, studied) };
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
    () => (item && word && item.kind === 'quiz' ? buildQuestion(word, item.cardType, words, Math.random, item.easy) : null),
    // a question is built once per queue item so options don't reshuffle on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.key],
  );

  const finish = useCallback(async () => {
    setFinished(true);
    const quickDone = mode === 'quick' && Date.now() - startedAt.current >= QUICK_SESSION_MS * 0.9;
    const queueDone = queue !== null && index >= queue.length - 1;
    if (mode !== 'weak' && (queueDone || quickDone) && (queue?.length ?? 0) > 0) await markGoalMet();
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
    // speak inside the tap handler: iOS only allows speech that starts from a user gesture
    const upcoming = queue[index + 1];
    if (autoplay && upcoming.kind === 'intro') speak(wordById.get(upcoming.wordId)?.word ?? '', settings.accent);
  }, [queue, index, mode, finish, autoplay, wordById, settings.accent]);

  const answer = useCallback(
    (outcome: AnswerOutcome, given?: string) => {
      if (!item || result) return;
      const again = !outcome.correct && item.repeat < MAX_REPEATS;
      setResult({ outcome, given, again });
      if (autoplay && item.cardType !== 5 && word) speak(word.word, settings.accent);
      setTally((t) => ({ ...t, answered: t.answered + 1, correct: t.correct + (outcome.correct ? 1 : 0) }));
      void recordAnswer(item.wordId, item.cardType, outcome, item.graded, ENABLED_CARD_TYPES).then(({ levelUp }) => {
        if (levelUp) setTally((t) => ({ ...t, movedUp: t.movedUp + 1 }));
      });
      if (!outcome.correct && queue) setQueue(requeueAfterMistake(queue, index));
      if (seenTypes && !seenTypes.includes(item.cardType)) {
        const updated = [...seenTypes, item.cardType];
        setSeenTypes(updated);
        void db.kv.put({ key: 'seenCardTypes', value: updated });
      }
    },
    [item, result, queue, index, autoplay, word, settings.accent, seenTypes],
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
      <button className="icon-btn" aria-label="סיום האימון" onClick={() => go('')}>
        <CloseIcon />
      </button>
      <div className="progress" aria-label="ההתקדמות באימון">
        <span style={{ width: `${queue.length ? ((index + (result || finished ? 1 : 0)) / queue.length) * 100 : 100}%` }} />
      </div>
      {mode === 'quick' && !finished ? (
        <span className="timer" aria-label="זמן שנותר">
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
        <Summary empty={queue.length === 0} tally={tally} weak={mode === 'weak'} />
      </>
    );
  }

  if (!item || !word) {
    // a word was removed since the queue was built
    return (
      <>
        {header}
        <button className="btn block" onClick={next}>
          דילוג
        </button>
      </>
    );
  }

  if (item.kind === 'intro') {
    return (
      <>
        {header}
        <div className="q-head">
          <span className="prompt-kind">מילה חדשה</span>
          <span className="small muted">קראו, הקשיבו ושימו לב לדוגמאות</span>
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
            הבנתי, אפשר להמשיך
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {question && seenTypes && !seenTypes.includes(question.type) && (
        <div className="explainer" role="note">
          <strong>סוג כרטיס חדש · {CARD_TYPE_LABEL[question.type]}</strong>
          <span>{CARD_TYPE_HELP[question.type]}</span>
        </div>
      )}
      {question && <QuestionView key={item.key} q={question} result={result} onAnswer={answer} repeat={item.repeat > 0} />}
      {result && (
        <>
          <Feedback q={question!} word={word} result={result} />
          <div className="bottom-actions">
            <button className="btn primary block" onClick={next} autoFocus>
              המשך
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
    <div className="q-head">
      <span className="prompt-kind">{CARD_QUESTION[q.type]}</span>
      {repeat && <span className="chip">ניסיון נוסף</span>}
    </div>
  );

  switch (q.type) {
    case 1:
      return (
        <div>
          {kind}
          <section className="card prompt-card" dir="ltr" lang="en">
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
        <div>
          {kind}
          <section className="card prompt-card" dir="ltr" lang="en">
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
        <div>
          {kind}
          <section className="card prompt-card" dir="ltr" lang="en">
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
    <>
      <div className="options" role="group" aria-label="אפשרויות" dir="ltr" lang="en">
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
      {!result && (
        <button type="button" className="btn ghost block small" style={{ marginTop: 6 }} onClick={() => onAnswer({ correct: false }, '')}>
          לא בטוח/ה — להציג את התשובה
        </button>
      )}
    </>
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
  const [hints, setHints] = useState(0);
  const canHint = hints < maxHints(q.word.word);
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (result || !value.trim()) return;
    const m = matchAnswer(value, q.word.word, alternativeSpellings(q.word.word));
    // a correct answer after hints still counts, but is scheduled a little sooner
    onAnswer({ correct: m !== 'wrong', hard: m === 'typo' || hints > 0 }, value.trim());
  };
  const state = result ? (result.outcome.correct ? ' correct' : ' wrong') : '';
  return (
    <form onSubmit={submit}>
      {kind}
      <section className="card prompt-card" dir="ltr" lang="en">
        <p className="prompt-text">{q.word.def}</p>
        <p className="pos" style={{ margin: '8px 0 0' }}>
          {q.word.pos}
        </p>
        <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
          <div className="hint" style={{ marginTop: 0, flex: 1 }} aria-label="רמז: האותיות שנחשפו">
            {hints ? typingHint(q.word.word, hints) : q.hint}
          </div>
          {!result && canHint && (
            <button type="button" className="btn small" onClick={() => setHints(hints + 1)}>
              רמז
            </button>
          )}
        </div>
      </section>
      <div style={{ marginTop: 14 }}>
        <input
          className={'answer-input' + state}
          dir="ltr"
          lang="en"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type the word…"
          aria-label="התשובה שלך"
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
            להציג תשובה
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            בדיקה
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
  let verdict: React.ReactNode;
  if (q.type === 5) verdict = outcome.correct ? 'נשמר! עכשיו נסו להשתמש בה גם בחיים' : 'נשמר — המילה תחזור לתרגול נוסף';
  else if (typo) verdict = <>כמעט! שימו לב לאיות: <En>{word.word}</En></>;
  else if (outcome.correct) verdict = outcome.hard ? 'נכון — בעזרת רמז קטן' : PRAISE[word.id.length % PRAISE.length];
  else if (!given) verdict = q.type === 4 ? <>המילה המדויקת היא <En>{q.answer}</En></> : <>הנה התשובה: <En>{word.word}</En></>;
  else verdict = q.type === 4 ? <>המילה המדויקת: <En>{q.answer}</En></> : <>לא בדיוק — התשובה היא <En>{word.word}</En></>;

  return (
    <section className={'feedback ' + cls} aria-live="polite">
      <div className="verdict">{verdict}</div>
      {result.again && <div className="small muted">לא נורא — המילה תחזור עוד כמה כרטיסים.</div>}
      {q.type === 3 && given && !outcome.correct && (
        <div className="small muted">
          כתבת: <s><En>{given}</En></s>
        </div>
      )}
      {q.type === 4 && (
        <>
          <div className="field-label">למה?</div>
          <p className="note" dir="ltr" lang="en" style={{ marginTop: 0 }}>
            {q.why}
          </p>
        </>
      )}
      {chosen && chosen.id !== word.id && (
        <p className="note small" style={{ marginTop: 8 }}>
          המילה שבחרת, <En>{chosen.word}</En>, פירושה: <span dir="ltr" lang="en" style={{ display: 'block' }}>{chosen.def}</span>
        </p>
      )}
      {q.type !== 5 && (
        <div className="card" style={{ marginTop: 12 }}>
          <WordEntryView word={word} brief />
        </div>
      )}
    </section>
  );
}

function Summary({ empty, tally, weak }: { empty: boolean; tally: { answered: number; correct: number; introduced: number; movedUp: number }; weak: boolean }) {
  if (empty) {
    return (
      <div className="empty">
        <div className="big-emoji">✓</div>
        <h2>אין מה לתרגל כרגע</h2>
        <p>{weak ? 'עדיין אין מילים חלשות — המשיכו כך!' : 'אין חזרות שממתינות, והמילים החדשות של היום כבר נלמדו.'}</p>
        <button className="btn primary" onClick={() => go('')}>
          חזרה לדף הבית
        </button>
      </div>
    );
  }
  const pct = tally.answered ? Math.round((tally.correct / tally.answered) * 100) : 0;
  return (
    <div className="empty">
      <div className="big-emoji">✓</div>
      <h2 style={{ marginBottom: 4 }}>סיימת את האימון!</h2>
      <p className="muted">
        {pct >= 90 ? 'אימון מצוין!' : pct >= 70 ? 'עבודה יפה.' : 'מאמץ יפה — מילים קשות חוזרות עד שהן נקלטות.'}
        {tally.movedUp > 0 && (
          <>
            <br />
            <strong style={{ color: 'var(--ink)' }}>
              {tally.movedUp === 1 ? 'מילה אחת עלתה שלב.' : `${tally.movedUp} מילים עלו שלב.`}
            </strong>
          </>
        )}
      </p>
      <div className="stat-row" style={{ margin: '20px 0' }}>
        <div className="stat">
          <div className="num">{tally.answered}</div>
          <div className="lbl">תשובות</div>
        </div>
        <div className="stat">
          <div className="num">{pct}%</div>
          <div className="lbl">נכונות</div>
        </div>
        <div className="stat">
          <div className="num">{tally.introduced}</div>
          <div className="lbl">מילים חדשות</div>
        </div>
      </div>
      <button className="btn primary block" onClick={() => go('')}>
        סיום
      </button>
    </div>
  );
}

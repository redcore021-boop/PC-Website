import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { go } from '../lib/router';
import { speak, speechSupported } from '../lib/speech';
import { heardCorrectly, listenOnce, recognitionSupported, RECOGNITION_ERROR_TEXT, type Listening, type RecognitionError } from '../lib/recognition';
import { shortHe, simpleDef } from '../lib/words';
import { shuffle } from '../lib/random';
import {
  BEST_KEY,
  buildListening,
  buildQuiz,
  gamePool,
  isBetter,
  MIN_GAME_WORDS,
  pickPairs,
  QUIZ_KIND_LABEL,
  quizVerdict,
  trueFalseItem,
  type BestScores,
  type GameKey,
  type QuizQuestion,
  type TrueFalseItem,
} from '../lib/games';
import type { WordEntry } from '../types';
import { CloseIcon, MicIcon } from '../components/Icons';
import { AudioButton } from '../components/AudioButton';

const SPEED_SECONDS = 60;
const MATCH_PAIRS = 6;
const MISTAKE_PENALTY = 3;
const SPEAK_WORDS = 8;
const SPEAK_TRIES = 3;

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function useBest() {
  return useLiveQuery(() => db.kv.get(BEST_KEY).then((r) => (r?.value as BestScores) ?? {}), [], undefined);
}

/** Saves the score if it beats the best; says whether it broke an earlier record (the first game sets one quietly). */
async function saveBest(game: GameKey, score: number): Promise<boolean> {
  const best = ((await db.kv.get(BEST_KEY))?.value as BestScores) ?? {};
  if (!isBetter(game, score, best[game])) return false;
  await db.kv.put({ key: BEST_KEY, value: { ...best, [game]: score } });
  return best[game] !== undefined;
}

function usePool(): WordEntry[] | undefined {
  const { words } = useApp();
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  return useMemo(() => (progress ? gamePool(words, progress) : undefined), [words, progress]);
}

/* ------------------------------------------------------------------ */
/* Hub                                                                 */
/* ------------------------------------------------------------------ */

export function PlayHub() {
  const pool = usePool();
  const best = useBest();
  if (!pool || !best) return null;
  const locked = pool.length < MIN_GAME_WORDS;
  const quizSizes = [10, 20].filter((n, i) => i === 0 || pool.length >= n);

  return (
    <>
      <header className="topbar">
        <h1>מבחנים ומשחקים</h1>
      </header>
      <p className="muted small" style={{ marginTop: -4 }}>
        תרגול על {pool.length} המילים שכבר התחלת. לא משנה את לוח החזרות שלך.
      </p>

      {locked ? (
        <section className="card center">
          <h2 style={{ margin: '4px 0 6px' }}>עוד רגע זה נפתח</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            המבחנים והמשחקים בנויים מהמילים שלמדת. התחילו לפחות {MIN_GAME_WORDS} מילים באימון היומי, והם ייפתחו.
          </p>
          <button className="btn primary block" onClick={() => go('session', 'daily')}>
            לאימון היומי
          </button>
        </section>
      ) : (
        <div className="games">
          <section className="card game-tile">
            <div className="game-head">
              <span className="game-emoji" aria-hidden>
                📝
              </span>
              <div style={{ flex: 1 }}>
                <h2>מבחן</h2>
                <p>שאלות מעורבבות: תרגום, הסבר, השלמת משפט ופירוש.</p>
              </div>
            </div>
            {best.quiz !== undefined && <div className="game-best">השיא שלך: {best.quiz}%</div>}
            <div className="row" style={{ gap: 8 }}>
              {quizSizes.map((n) => (
                <button key={n} className={'btn block' + (n === 10 ? ' primary' : '')} onClick={() => go('play', 'quiz', String(n))}>
                  {Math.min(n, pool.length)} שאלות
                </button>
              ))}
            </div>
          </section>

          <GameTile
            emoji="🧩"
            title="התאמת זוגות"
            text="מחברים כל מילה לתרגום שלה, מהר ככל האפשר."
            best={best.match !== undefined ? `השיא שלך: ${fmtTime(best.match)}` : undefined}
            onPlay={() => go('play', 'match')}
          />
          <GameTile
            emoji="⚡"
            title="נכון או לא נכון"
            text={`${SPEED_SECONDS} שניות. האם זה התרגום הנכון?`}
            best={best.speed !== undefined ? `השיא שלך: ${best.speed} נכונות` : undefined}
            onPlay={() => go('play', 'speed')}
          />
          {recognitionSupported() ? (
            <GameTile
              emoji="🎤"
              title="הגייה"
              text="אומרים את המילה בקול, והטלפון בודק אם הבין אתכם."
              best={best.speak !== undefined ? `השיא שלך: ${best.speak}%` : undefined}
              onPlay={() => go('play', 'speak')}
            />
          ) : (
            <section className="card game-tile off">
              <div className="game-head">
                <span className="game-emoji" aria-hidden>
                  🎤
                </span>
                <div style={{ flex: 1 }}>
                  <h2>הגייה</h2>
                  <p>הדפדפן הזה לא תומך בזיהוי דיבור. זה עובד בכרום באנדרואיד ובספארי באייפון.</p>
                </div>
              </div>
            </section>
          )}
          {speechSupported() && (
            <GameTile
              emoji="🎧"
              title="מבחן שמיעה"
              text="שומעים מילה ובוחרים את הפירוש שלה."
              best={best.listen !== undefined ? `השיא שלך: ${best.listen}%` : undefined}
              onPlay={() => go('play', 'listen')}
            />
          )}
        </div>
      )}
    </>
  );
}

function GameTile({ emoji, title, text, best, onPlay }: { emoji: string; title: string; text: string; best?: string; onPlay: () => void }) {
  return (
    <button className="card game-tile clickable" onClick={onPlay}>
      <div className="game-head">
        <span className="game-emoji" aria-hidden>
          {emoji}
        </span>
        <div style={{ flex: 1 }}>
          <h2>{title}</h2>
          <p>{text}</p>
          {best && <div className="game-best">{best}</div>}
        </div>
        <span className="chev">‹</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Game runner                                                         */
/* ------------------------------------------------------------------ */

export function Game({ game, size }: { game: GameKey; size?: string }) {
  const pool = usePool();
  const { words } = useApp();
  const [round, setRound] = useState(0);
  const ready = !!pool && pool.length >= MIN_GAME_WORDS;
  useEffect(() => {
    if (pool && !ready) go('play');
  }, [pool, ready]);
  // built once per round, so live data updates never reshuffle a game in progress
  const screen = useMemo(() => {
    if (!pool || !ready) return null;
    const again = () => setRound((r) => r + 1);
    switch (game) {
      case 'quiz':
        return <QuizGame key={round} game="quiz" questions={buildQuiz(pool, words, Math.max(5, Number(size) || 10))} onAgain={again} />;
      case 'listen':
        return <QuizGame key={round} game="listen" questions={buildListening(pool, words, 10)} onAgain={again} />;
      case 'match':
        return <MatchGame key={round} pairs={pickPairs(pool, MATCH_PAIRS)} onAgain={again} />;
      case 'speed':
        return <SpeedGame key={round} pool={pool} all={words} onAgain={again} />;
      case 'speak':
        return <SpeakGame key={round} words={shuffle(pool).slice(0, SPEAK_WORDS)} onAgain={again} />;
    }
  }, [round, ready, game, size]);
  return screen;
}

function TopBar({ fraction, right }: { fraction: number; right: React.ReactNode }) {
  return (
    <div className="session-top">
      <button className="icon-btn" aria-label="יציאה" onClick={() => go('play')}>
        <CloseIcon />
      </button>
      <div className="progress">
        <span style={{ width: `${Math.min(100, fraction * 100)}%` }} />
      </div>
      <span className="timer">{right}</span>
    </div>
  );
}

/* ---------- Quiz & listening ---------- */

function QuizGame({ game, questions, onAgain }: { game: 'quiz' | 'listen'; questions: QuizQuestion[]; onAgain: () => void }) {
  const { settings } = useApp();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<QuizQuestion[]>([]);
  const [done, setDone] = useState<{ pct: number; record: boolean } | null>(null);
  const q = questions[index];
  const listen = game === 'listen';

  useEffect(() => {
    if (listen && q && !done) speak(q.word.word, settings.accent);
  }, [listen, q, done, settings.accent]);

  const next = async (wrongSoFar: QuizQuestion[]) => {
    setPicked(null);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    const pct = Math.round(((questions.length - wrongSoFar.length) / questions.length) * 100);
    setDone({ pct, record: await saveBest(game, pct) });
  };

  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
    if (o === q.answer) {
      if (settings.autoplayAudio && !listen) speak(q.word.word, settings.accent);
      setTimeout(() => void next(wrong), 650);
    } else {
      setWrong([...wrong, q]);
    }
  };

  if (done) {
    return (
      <GameResult
        big={`${done.pct}%`}
        line={`${questions.length - wrong.length} מתוך ${questions.length} נכונות`}
        verdict={quizVerdict(done.pct)}
        record={done.record}
        missed={wrong.map((x) => x.word)}
        onAgain={onAgain}
      />
    );
  }

  const isWrong = picked !== null && picked !== q.answer;
  return (
    <>
      <TopBar fraction={(index + (picked ? 1 : 0)) / questions.length} right={`${index + 1}/${questions.length}`} />
      <div className="q-head">
        <span className="prompt-kind">{listen ? 'מה הפירוש של המילה ששמעתם?' : QUIZ_KIND_LABEL[q.kind]}</span>
      </div>

      {listen ? (
        <section className="card prompt-card center">
          <button className="listen-btn" onClick={() => speak(q.word.word, settings.accent)} aria-label="השמעה חוזרת">
            🔊
          </button>
          <p className="tiny faint" style={{ margin: '10px 0 0' }}>
            {picked ? (
              <bdi lang="en" className="listen-word">
                {q.word.word}
              </bdi>
            ) : (
              'אפשר להשמיע שוב'
            )}
          </p>
        </section>
      ) : q.kind === 'he' ? (
        <section className="card prompt-card">
          <p className="prompt-text he-prompt" dir="rtl" lang="he">
            {q.prompt}
          </p>
        </section>
      ) : q.kind === 'meaning' ? (
        <section className="card prompt-card" dir="ltr" lang="en">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="headword" style={{ margin: 0 }}>
              {q.prompt}
            </h2>
            <AudioButton text={q.word.word} />
          </div>
        </section>
      ) : (
        <section className="card prompt-card" dir="ltr" lang="en">
          <p className="prompt-text">
            {q.kind === 'gap' ? (
              <>
                {q.before}
                <span className={'blank' + (picked ? ' filled' : '')}>{picked ? q.word.word : '\u00a0'}</span>
                {q.after}
              </>
            ) : (
              q.prompt
            )}
          </p>
        </section>
      )}

      <div className="options" role="group" aria-label="אפשרויות" dir={q.lang === 'he' ? 'rtl' : 'ltr'} lang={q.lang}>
        {q.options.map((o) => {
          let cls = 'option';
          if (picked) cls += o === q.answer ? ' correct' : o === picked ? ' wrong' : ' dim';
          return (
            <button key={o} className={cls} disabled={!!picked} onClick={() => choose(o)}>
              {o}
            </button>
          );
        })}
      </div>

      {isWrong && (
        <div className="feedback bad">
          <div className="verdict">לא בדיוק</div>
          <p style={{ margin: '6px 0 0' }}>
            <bdi lang="en" style={{ fontWeight: 700 }}>
              {q.word.word}
            </bdi>{' '}
            = {shortHe(q.word)}
          </p>
          <p className="small muted" dir="ltr" lang="en" style={{ margin: '4px 0 0', textAlign: 'start' }}>
            {simpleDef(q.word)}
          </p>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => void next(wrong)}>
            {index + 1 < questions.length ? 'הבא' : 'לתוצאה'}
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Matching pairs ---------- */

function MatchGame({ pairs, onAgain }: { pairs: WordEntry[]; onAgain: () => void }) {
  const left = useMemo(() => shuffle(pairs), [pairs]);
  const right = useMemo(() => shuffle(pairs), [pairs]);
  const [sel, setSel] = useState<{ side: 'en' | 'he'; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ score: number; secs: number; record: boolean } | null>(null);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [done]);

  const secs = Math.floor((now - started.current) / 1000);

  const tap = (side: 'en' | 'he', id: string) => {
    if (matched.has(id) || flash.length) return;
    if (!sel || sel.side === side) {
      setSel(sel?.side === side && sel.id === id ? null : { side, id });
      return;
    }
    if (sel.id === id) {
      const m = new Set(matched).add(id);
      setMatched(m);
      setSel(null);
      if (m.size === pairs.length) {
        const s = Math.floor((Date.now() - started.current) / 1000);
        const score = s + mistakes * MISTAKE_PENALTY;
        void saveBest('match', score).then((record) => setDone({ score, secs: s, record }));
      }
    } else {
      setMistakes(mistakes + 1);
      setMissed(new Set(missed).add(sel.side === 'en' ? sel.id : id));
      setFlash([sel.side + sel.id, side + id]);
      setTimeout(() => {
        setFlash([]);
        setSel(null);
      }, 600);
    }
  };

  if (done) {
    return (
      <GameResult
        big={fmtTime(done.score)}
        line={mistakes ? `${fmtTime(done.secs)} + ${mistakes * MISTAKE_PENALTY} שניות על ${mistakes === 1 ? 'טעות אחת' : `${mistakes} טעויות`}` : 'בלי אף טעות!'}
        verdict={mistakes === 0 ? 'מושלם!' : 'כל הכבוד!'}
        record={done.record}
        missed={pairs.filter((w) => missed.has(w.id))}
        onAgain={onAgain}
      />
    );
  }

  const cell = (side: 'en' | 'he', w: WordEntry) => {
    const on = matched.has(w.id);
    const cls =
      'pair' +
      (on ? ' done' : '') +
      (sel?.side === side && sel.id === w.id ? ' sel' : '') +
      (flash.includes(side + w.id) ? ' bad' : '');
    return (
      <button key={side + w.id} className={cls} disabled={on} onClick={() => tap(side, w.id)} dir={side === 'en' ? 'ltr' : 'rtl'} lang={side}>
        {side === 'en' ? w.word : shortHe(w)}
      </button>
    );
  };

  return (
    <>
      <TopBar fraction={matched.size / pairs.length} right={fmtTime(secs)} />
      <div className="q-head">
        <span className="prompt-kind">מחברים כל מילה לתרגום שלה</span>
        {mistakes > 0 && <span className="chip bad">{mistakes === 1 ? 'טעות אחת' : `${mistakes} טעויות`}</span>}
      </div>
      <div className="pairs">
        <div className="pair-col">{right.map((w) => cell('he', w))}</div>
        <div className="pair-col">{left.map((w) => cell('en', w))}</div>
      </div>
      <p className="tiny faint center">כל טעות מוסיפה {MISTAKE_PENALTY} שניות לזמן.</p>
    </>
  );
}

/* ---------- True or false, against the clock ---------- */

function SpeedGame({ pool, all, onAgain }: { pool: WordEntry[]; all: WordEntry[]; onAgain: () => void }) {
  const [item, setItem] = useState<TrueFalseItem>(() => trueFalseItem(pool, all));
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [missed, setMissed] = useState<WordEntry[]>([]);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ record: boolean } | null>(null);
  const scoreRef = useRef(0);

  const left = started === null ? SPEED_SECONDS : Math.max(0, SPEED_SECONDS - Math.floor((now - started) / 1000));

  useEffect(() => {
    if (started === null || done) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [started, done]);

  useEffect(() => {
    if (started !== null && left === 0 && !done) void saveBest('speed', scoreRef.current).then((record) => setDone({ record }));
  }, [left, started, done]);

  const answer = (yes: boolean) => {
    if (flash || done) return;
    const right = yes === item.isMatch;
    setAnswered(answered + 1);
    if (right) {
      scoreRef.current++;
      setScore(scoreRef.current);
    } else if (!missed.some((w) => w.id === item.word.id)) {
      setMissed([...missed, item.word]);
    }
    setFlash(right ? 'good' : 'bad');
    setTimeout(
      () => {
        setFlash(null);
        setItem(trueFalseItem(pool, all, Math.random, item.word.id));
      },
      right ? 250 : 900,
    );
  };

  if (done) {
    const pct = answered ? Math.round((score / answered) * 100) : 0;
    return (
      <GameResult
        big={String(score)}
        line={`תשובות נכונות ב־${SPEED_SECONDS} שניות · ${answered ? `${pct}% דיוק` : 'לא נענו שאלות'}`}
        verdict={score >= 25 ? 'מהירות של מקצוען!' : score >= 15 ? 'מהיר ומדויק!' : 'יפה! בפעם הבאה זה ילך עוד יותר מהר.'}
        record={done.record}
        missed={missed}
        onAgain={onAgain}
      />
    );
  }

  if (started === null) {
    return (
      <>
        <TopBar fraction={0} right={fmtTime(SPEED_SECONDS)} />
        <div className="empty">
          <div className="big-emoji">⚡</div>
          <h2>נכון או לא נכון</h2>
          <p>
            מופיעה מילה ותרגום. האם התרגום נכון?
            <br />
            יש לכם {SPEED_SECONDS} שניות לענות על כמה שיותר.
          </p>
          <button className="btn primary block" onClick={() => setStarted(Date.now())}>
            מתחילים!
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar fraction={(SPEED_SECONDS - left) / SPEED_SECONDS} right={fmtTime(left)} />
      <div className="q-head">
        <span className="prompt-kind">האם זה התרגום הנכון?</span>
        <span className="chip accent">{score} נכונות</span>
      </div>
      <section className={'card tf-card' + (flash ? ' ' + flash : '')}>
        <div className="tf-word" dir="ltr" lang="en">
          {item.word.word}
        </div>
        <div className="tf-eq" aria-hidden>
          =
        </div>
        <div className="tf-he" lang="he">
          {item.shown}
        </div>
        {flash === 'bad' && (
          <div className="small" style={{ marginTop: 10, color: 'var(--bad)' }}>
            {item.isMatch ? 'דווקא נכון!' : `לא — הפירוש הוא ${shortHe(item.word)}`}
          </div>
        )}
      </section>
      <div className="tf-buttons">
        <button className="btn tf-yes" onClick={() => answer(true)}>
          ✓ נכון
        </button>
        <button className="btn tf-no" onClick={() => answer(false)}>
          ✗ לא נכון
        </button>
      </div>
    </>
  );
}

/* ---------- Pronunciation ---------- */

type SpeakState =
  | { s: 'idle' }
  | { s: 'listening' }
  | { s: 'good'; heard: string }
  | { s: 'bad'; heard: string }
  | { s: 'error'; error: RecognitionError };

function SpeakGame({ words, onAgain }: { words: WordEntry[]; onAgain: () => void }) {
  const { settings } = useApp();
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<SpeakState>({ s: 'idle' });
  const [tries, setTries] = useState(0);
  const [missed, setMissed] = useState<WordEntry[]>([]);
  const [done, setDone] = useState<{ pct: number; record: boolean } | null>(null);
  const active = useRef<Listening | null>(null);
  const w = words[index];

  useEffect(() => () => active.current?.stop(), []);

  const next = async (missedNow: WordEntry[]) => {
    setState({ s: 'idle' });
    setTries(0);
    if (index + 1 < words.length) {
      setIndex(index + 1);
      return;
    }
    const pct = Math.round(((words.length - missedNow.length) / words.length) * 100);
    setDone({ pct, record: await saveBest('speak', pct) });
  };

  const listen = async () => {
    if (state.s === 'listening') {
      active.current?.stop();
      return;
    }
    setState({ s: 'listening' });
    const l = listenOnce(settings.accent);
    active.current = l;
    try {
      const heard = await l.result;
      if (heardCorrectly(heard, w.word)) {
        setState({ s: 'good', heard: heard[0] });
        setTimeout(() => void next(missed), 1300);
      } else {
        setTries(tries + 1);
        setState({ s: 'bad', heard: heard[0] });
      }
    } catch (e) {
      setState({ s: 'error', error: (typeof e === 'string' ? e : 'other') as RecognitionError });
    } finally {
      active.current = null;
    }
  };

  const giveUp = () => {
    const m = missed.some((x) => x.id === w.id) ? missed : [...missed, w];
    setMissed(m);
    void next(m);
  };

  if (done) {
    return (
      <GameResult
        big={`${done.pct}%`}
        line={`${words.length - missed.length} מתוך ${words.length} מילים נאמרו נכון`}
        verdict={done.pct >= 90 ? 'הגייה מצוינת!' : done.pct >= 60 ? 'יפה מאוד!' : 'תרגול טוב. כדאי להקשיב ולנסות שוב.'}
        record={done.record}
        missed={missed}
        onAgain={onAgain}
      />
    );
  }

  const outOfTries = state.s === 'bad' && tries >= SPEAK_TRIES;
  return (
    <>
      <TopBar fraction={(index + (state.s === 'good' ? 1 : 0)) / words.length} right={`${index + 1}/${words.length}`} />
      <div className="q-head">
        <span className="prompt-kind">אמרו את המילה בקול</span>
        {tries > 0 && state.s !== 'good' && <span className="chip">ניסיון {Math.min(tries + 1, SPEAK_TRIES)} מתוך {SPEAK_TRIES}</span>}
      </div>
      <section className="card prompt-card center">
        <div className="row" style={{ justifyContent: 'center' }} dir="ltr">
          <h2 className="headword" lang="en" style={{ margin: 0 }}>
            {w.word}
          </h2>
          <AudioButton text={w.word} label="להקשיב להגייה" />
        </div>
        {w.ipa && (
          <div className="ipa" dir="ltr" style={{ marginTop: 4, textAlign: 'center' }}>
            /{w.ipa}/
          </div>
        )}
        <div className="muted" style={{ marginTop: 6 }}>
          {shortHe(w)}
        </div>
      </section>

      {state.s !== 'good' && !outOfTries && (
        <div className="center" style={{ marginTop: 20 }}>
          <button
            className={'mic-btn' + (state.s === 'listening' ? ' on' : '')}
            onClick={() => void listen()}
            aria-label={state.s === 'listening' ? 'עצירה' : 'להקליט'}
          >
            <MicIcon width={34} height={34} />
          </button>
          <div className="small muted" style={{ marginTop: 10 }}>
            {state.s === 'listening' ? 'מקשיב… אמרו את המילה' : 'לחצו ואמרו את המילה'}
          </div>
        </div>
      )}

      {state.s === 'good' && (
        <div className="feedback good">
          <div className="verdict">מצוין! הבנתי אתכם</div>
          <p className="small" style={{ margin: '4px 0 0' }}>
            זוהה: <bdi lang="en">{state.heard}</bdi>
          </p>
        </div>
      )}
      {state.s === 'bad' && (
        <div className="feedback bad">
          <div className="verdict">{outOfTries ? 'לא הפעם' : 'עוד לא מדויק'}</div>
          <p className="small" style={{ margin: '4px 0 0' }}>
            שמעתי: <bdi lang="en">{state.heard}</bdi>
          </p>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {outOfTries ? 'נמשיך הלאה, והמילה תופיע ברשימה לחזרה.' : 'הקשיבו להגייה ונסו שוב.'}
          </p>
        </div>
      )}
      {state.s === 'error' && (
        <div className="feedback typo">
          <p className="small" style={{ margin: 0 }}>
            {RECOGNITION_ERROR_TEXT[state.error]}
          </p>
        </div>
      )}

      {state.s !== 'good' && state.s !== 'listening' && (
        <button className={'btn block' + (outOfTries ? ' primary' : ' ghost small')} style={{ marginTop: 12 }} onClick={giveUp}>
          {outOfTries ? (index + 1 < words.length ? 'הבא' : 'לתוצאה') : 'לדלג על המילה'}
        </button>
      )}
    </>
  );
}

/* ---------- Shared result screen ---------- */

function GameResult({
  big,
  line,
  verdict,
  record,
  missed,
  onAgain,
}: {
  big: string;
  line: string;
  verdict: string;
  record: boolean;
  missed: WordEntry[];
  onAgain: () => void;
}) {
  return (
    <div className="game-result">
      <div className="empty" style={{ paddingBottom: 12 }}>
        {record && <div className="chip accent record">🏆 שיא חדש!</div>}
        <div className="result-big">{big}</div>
        <div className="muted small">{line}</div>
        <h2 style={{ margin: '14px 0 0' }}>{verdict}</h2>
      </div>

      {missed.length > 0 && (
        <>
          <h3 className="section-title">כדאי לחזור על</h3>
          <div className="list">
            {missed.map((w) => (
              <button key={w.id} className="list-item" onClick={() => go('word', w.id)}>
                <span className="main">
                  <span className="w">
                    <bdi lang="en">{w.word}</bdi>
                    <span className="w-he"> · {shortHe(w)}</span>
                  </span>
                  <span className="d" dir="ltr" lang="en" style={{ display: 'block', textAlign: 'start' }}>
                    {simpleDef(w)}
                  </span>
                </span>
                <span className="chev">‹</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="stack" style={{ marginTop: 20 }}>
        <button className="btn primary block" onClick={onAgain}>
          עוד סיבוב
        </button>
        <button className="btn block" onClick={() => go('play')}>
          לכל המבחנים והמשחקים
        </button>
      </div>
    </div>
  );
}

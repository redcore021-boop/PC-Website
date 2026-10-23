import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { dayKey } from '../lib/dates';
import { computeStreak, daysStudiedBefore, todayCounts } from '../lib/store';
import { dueProgress, effectiveNewPerDay } from '../lib/session';
import { StageLadder } from '../components/StageLadder';
import { hashUnit } from '../lib/words';
import { go } from '../lib/router';
import { WordEntryView } from '../components/WordBits';
import { BoltIcon, FlameIcon } from '../components/Icons';

export function Home() {
  const { words, settings } = useApp();
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const days = useLiveQuery(() => db.days.toArray(), [], []);
  const today = useLiveQuery(() => todayCounts(), [], undefined);
  const lastBackup = useLiveQuery(() => db.kv.get('lastBackup').then((r) => r?.value as number | undefined), [], undefined);
  const studied = useLiveQuery(() => daysStudiedBefore(), [], undefined);
  const whatsNewSeen = useLiveQuery(() => db.kv.get('whatsnew-gentle').then((r) => !!r), [], true);

  const wordOfDay = useMemo(() => {
    if (!words.length) return undefined;
    const pool = words.filter((w) => w.tier <= 2);
    const list = pool.length ? pool : words;
    return list[Math.floor(hashUnit('wotd-' + dayKey()) * list.length)];
  }, [words]);

  if (!progress || !today || studied === undefined) return null;

  const seen = new Set(progress.map((p) => p.wordId));
  const unseen = words.filter((w) => !seen.has(w.id)).length;
  const due = Math.min(dueProgress(progress).length, Math.max(0, settings.reviewsPerDay - today.reviews));
  const todaysPace = effectiveNewPerDay(settings.newPerDay, studied);
  const warmingUp = todaysPace < settings.newPerDay;
  const newLeft = Math.min(unseen, Math.max(0, todaysPace - today.newWords));
  const planned = due + newLeft;
  const doneToday = today.answered;
  const streak = computeStreak(days);
  const mastered = progress.filter((p) => p.mastered).length;
  const active = progress.filter((p) => !p.mastered);
  const stageCounts = {
    recognise: active.filter((p) => p.level <= 1).length,
    recall: active.filter((p) => p.level === 2).length,
    use: active.filter((p) => p.level >= 3).length,
    mastered,
  };
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const needsBackup = progress.length >= 20 && (!lastBackup || Date.now() - lastBackup > 7 * 864e5);

  return (
    <>
      <header className="topbar">
        <h1>
          <span className="brand">Lexicon</span>
        </h1>
        <span className={'chip' + (streak.todayDone ? ' accent' : '')} title="Day streak">
          <FlameIcon width={16} height={16} /> {streak.current}
        </span>
      </header>

      <section className="card hero">
        {planned > 0 ? (
          <>
            <div className="label">{greeting} — here's today's session</div>
            <div className="row" style={{ margin: '6px 0 14px', gap: 18 }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 750 }}>{due}</div>
                <div className="muted small">reviews due</div>
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 750 }}>{newLeft}</div>
                <div className="muted small">new words</div>
              </div>
            </div>
            {warmingUp && today.newWords === 0 && (
              <p className="small muted" style={{ marginTop: -6 }}>
                Warm-up week: {todaysPace} new words today, building up to {settings.newPerDay}.
              </p>
            )}
            {doneToday > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="progress" aria-label="Today's progress">
                  <span style={{ width: `${Math.min(100, (doneToday / (doneToday + planned)) * 100)}%` }} />
                </div>
                <div className="tiny faint" style={{ marginTop: 6 }}>
                  {doneToday} answers so far today
                </div>
              </div>
            )}
            <div className="stack">
              <button className="btn primary block" onClick={() => go('session', 'daily')}>
                {doneToday > 0 ? 'Continue' : 'Start'} today's session
              </button>
              <button className="btn block" onClick={() => go('session', 'quick')}>
                <BoltIcon width={18} height={18} /> Quick 10-minute session
              </button>
            </div>
          </>
        ) : (
          <div className="center">
            <div className="big-emoji" aria-hidden>
              ✓
            </div>
            <h2 style={{ margin: '10px 0 4px' }}>All done for today</h2>
            <p className="muted small" style={{ margin: '0 0 16px' }}>
              {unseen > 0 ? 'Your reviews are clear. Want to get ahead?' : 'You have seen every word in your list.'}
            </p>
            {unseen > 0 && (
              <button className="btn block" onClick={() => go('session', 'extra')}>
                Learn 5 more words
              </button>
            )}
          </div>
        )}
      </section>

      <div className="stat-row" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="num">{progress.length}</div>
          <div className="lbl">words started</div>
        </div>
        <div className="stat">
          <div className="num">{mastered}</div>
          <div className="lbl">mastered</div>
        </div>
        <div className="stat">
          <div className="num">{streak.best}</div>
          <div className="lbl">best streak</div>
        </div>
      </div>

      {!whatsNewSeen && progress.length > 0 && (
        <section className="card" style={{ marginTop: 12 }}>
          <strong>What's new: a gentler path</strong>
          <ul className="ob-list small" style={{ margin: '8px 0 12px' }}>
            <li>New words now come easiest and most useful first.</li>
            <li>The first quizzes of a word use clearly different options.</li>
            <li>Typing cards have a Hint button, and choice cards a “Not sure” button.</li>
            <li>Each new card type explains itself the first time.</li>
          </ul>
          <button className="btn small" onClick={() => db.kv.put({ key: 'whatsnew-gentle', value: Date.now() })}>
            Got it
          </button>
        </section>
      )}

      {progress.length > 0 && (
        <>
          <h3 className="section-title">Your words, from easy to hard</h3>
          <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <StageLadder counts={stageCounts} />
          </section>
        </>
      )}

      {needsBackup && (
        <button className="card row" style={{ width: '100%', marginTop: 12, textAlign: 'left' }} onClick={() => go('settings')}>
          <span style={{ flex: 1 }}>
            <strong>Back up your progress</strong>
            <span className="muted small" style={{ display: 'block' }}>
              Your data lives only on this phone. Export a backup file now and then.
            </span>
          </span>
          <span className="faint">›</span>
        </button>
      )}

      {wordOfDay && (
        <>
          <h3 className="section-title">Word of the day</h3>
          <section className="card">
            <WordEntryView word={wordOfDay} brief />
            <button className="btn small ghost" style={{ marginTop: 12, paddingLeft: 0 }} onClick={() => go('word', wordOfDay.id)}>
              Full entry ›
            </button>
          </section>
        </>
      )}
    </>
  );
}

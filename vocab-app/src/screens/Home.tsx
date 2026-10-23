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
import { BellIcon, BoltIcon, FlameIcon } from '../components/Icons';
import { StreakCard } from '../components/Streak';
import { ReminderSetup } from '../components/Reminder';

export function Home() {
  const { words, settings } = useApp();
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const days = useLiveQuery(() => db.days.toArray(), [], []);
  const today = useLiveQuery(() => todayCounts(), [], undefined);
  const lastBackup = useLiveQuery(() => db.kv.get('lastBackup').then((r) => r?.value as number | undefined), [], undefined);
  const studied = useLiveQuery(() => daysStudiedBefore(), [], undefined);
  const reminderAsked = useLiveQuery(
    () => Promise.all([db.kv.get('reminderSet'), db.kv.get('reminderDismissed')]).then(([a, b]) => !!(a || b)),
    [],
    true,
  );
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
  const greeting = hour < 5 ? 'לילה טוב' : hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
  const needsBackup = progress.length >= 20 && (!lastBackup || Date.now() - lastBackup > 7 * 864e5);

  return (
    <>
      <header className="topbar">
        <h1>
          <span className="brand">Lexicon</span>
        </h1>
        <span className={'chip' + (streak.todayDone ? ' accent' : '')} title="ימים ברצף">
          <FlameIcon width={16} height={16} /> {streak.current}
        </span>
      </header>

      <section className="card hero">
        {planned > 0 ? (
          <>
            <div className="label">{greeting}! זה האימון של היום</div>
            <div className="row" style={{ margin: '6px 0 14px', gap: 18 }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 750 }}>{due}</div>
                <div className="muted small">חזרות</div>
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 750 }}>{newLeft}</div>
                <div className="muted small">מילים חדשות</div>
              </div>
            </div>
            {warmingUp && today.newWords === 0 && (
              <p className="small muted" style={{ marginTop: -6 }}>
                שבוע חימום: היום {todaysPace} מילים חדשות, ובהדרגה עד {settings.newPerDay} ביום.
              </p>
            )}
            {doneToday > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="progress" aria-label="ההתקדמות של היום">
                  <span style={{ width: `${Math.min(100, (doneToday / (doneToday + planned)) * 100)}%` }} />
                </div>
                <div className="tiny faint" style={{ marginTop: 6 }}>
                  ענית על {doneToday} כרטיסים היום
                </div>
              </div>
            )}
            <div className="stack">
              <button className="btn primary block" onClick={() => go('session', 'daily')}>
                {doneToday > 0 ? 'להמשיך את האימון' : 'להתחיל את האימון'}
              </button>
              <button className="btn block" onClick={() => go('session', 'quick')}>
                <BoltIcon width={18} height={18} /> אימון קצר של 10 דקות
              </button>
            </div>
          </>
        ) : (
          <div className="center">
            <div className="big-emoji" aria-hidden>
              ✓
            </div>
            <h2 style={{ margin: '10px 0 4px' }}>סיימת להיום, כל הכבוד!</h2>
            <p className="muted small" style={{ margin: '0 0 16px' }}>
              {unseen > 0 ? 'אין חזרות שמחכות. רוצה להתקדם עוד קצת?' : 'כבר פגשת את כל המילים ברשימה.'}
            </p>
            {unseen > 0 && (
              <button className="btn block" onClick={() => go('session', 'extra')}>
                ללמוד עוד 5 מילים
              </button>
            )}
          </div>
        )}
      </section>

      {progress.length > 0 && <StreakCard days={days} />}

      {!reminderAsked && progress.length > 0 && (
        <section className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <BellIcon width={20} height={20} />
            <strong style={{ flex: 1 }}>רוצים תזכורת כל יום?</strong>
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>
            כמה דקות ביום עובדות הכי טוב. התזכורת נכנסת ליומן של הטלפון ומקפיצה התראה בשעה שבחרתם.
          </p>
          <ReminderSetup />
          <button className="btn small ghost block" style={{ marginTop: 8 }} onClick={() => db.kv.put({ key: 'reminderDismissed', value: Date.now() })}>
            לא עכשיו
          </button>
        </section>
      )}

      {progress.length > 0 && (
      <div className="stat-row" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="num">{progress.length}</div>
          <div className="lbl">מילים בלמידה</div>
        </div>
        <div className="stat">
          <div className="num">{mastered}</div>
          <div className="lbl">בשליטה מלאה</div>
        </div>
        <div className="stat">
          <div className="num">{stageCounts.use}</div>
          <div className="lbl">בשלב השימוש</div>
        </div>
      </div>
      )}

      {!whatsNewSeen && progress.length > 0 && (
        <section className="card" style={{ marginTop: 12 }}>
          <strong>מה חדש: הכול בעברית, ומתקדמים בהדרגה</strong>
          <ul className="ob-list small" style={{ margin: '8px 0 12px' }}>
            <li>המילים החדשות מגיעות מהקלות והשימושיות אל הקשות.</li>
            <li>בפעמים הראשונות שמילה נבחנת, התשובות השגויות שונות ממנה בבירור.</li>
            <li>בכרטיס ההקלדה יש כפתור „רמז”, ובשאלות בחירה — „לא בטוח/ה”.</li>
            <li>כל סוג כרטיס חדש מסביר את עצמו בפעם הראשונה.</li>
          </ul>
          <button className="btn small" onClick={() => db.kv.put({ key: 'whatsnew-gentle', value: Date.now() })}>
            הבנתי
          </button>
        </section>
      )}

      {progress.length > 0 && (
        <>
          <h3 className="section-title">המילים שלך, מקל לקשה</h3>
          <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <StageLadder counts={stageCounts} />
          </section>
        </>
      )}

      {needsBackup && (
        <button className="card row" style={{ width: '100%', marginTop: 12, textAlign: 'start' }} onClick={() => go('settings')}>
          <span style={{ flex: 1 }}>
            <strong>כדאי לגבות את ההתקדמות</strong>
            <span className="muted small" style={{ display: 'block' }}>
              הנתונים שמורים רק בטלפון הזה. מומלץ לייצא קובץ גיבוי מדי פעם.
            </span>
          </span>
          <span className="chev">‹</span>
        </button>
      )}

      {wordOfDay && (
        <>
          <h3 className="section-title">המילה של היום</h3>
          <section className="card">
            <WordEntryView word={wordOfDay} brief />
            <button className="btn small ghost" style={{ marginTop: 12, paddingInline: 0 }} onClick={() => go('word', wordOfDay.id)}>
              לכל הפרטים ‹
            </button>
          </section>
        </>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { endOfStudyDay } from '../lib/dates';
import { statusOf } from '../lib/status';
import { retrievability } from '../lib/srs';
import { weakestProgress } from '../lib/session';
import { shortHe } from '../lib/words';
import { CARD_TYPE_LABEL, formatDate } from '../strings';
import { go } from '../lib/router';
import type { CardType } from '../types';

const DAY = 864e5;

export function Stats() {
  const { words, wordById } = useApp();
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const since = Date.now() - 30 * DAY;
  const recent = useLiveQuery(() => db.reviews.where('at').above(since).toArray(), [], undefined);

  const forecast = useMemo(() => {
    if (!progress) return [];
    const end = endOfStudyDay();
    const days = Array.from({ length: 14 }, (_, i) => {
      const cutoff = new Date(+end + i * DAY);
      const d = new Date(+cutoff - 12 * 3600e3);
      return {
        label: i === 0 ? 'היום' : i === 1 ? 'מחר' : formatDate(d, { weekday: 'short' }),
        date: formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' }),
        cutoff: +cutoff,
        count: 0,
      };
    });
    for (const p of progress) {
      if (p.suspended) continue;
      const due = +new Date(p.card.due);
      const slot = days.find((d) => due <= d.cutoff);
      if (slot) slot.count++;
    }
    return days;
  }, [progress]);

  if (!progress || !recent) return null;

  const statuses = progress.map((p) => statusOf(p));
  const known = statuses.filter((s) => s === 'known').length;
  const mastered = statuses.filter((s) => s === 'mastered').length;
  const graded = recent.filter((r) => r.review);
  const retention = graded.length ? Math.round((graded.filter((r) => r.correct).length / graded.length) * 100) : null;
  const byType = ([1, 2, 3, 4, 5] as CardType[]).map((t) => {
    const rows = recent.filter((r) => r.cardType === t && r.rating > 0);
    return { t, n: rows.length, pct: rows.length ? Math.round((rows.filter((r) => r.correct).length / rows.length) * 100) : null };
  });
  const activeDays = new Set(recent.map((r) => r.day)).size;
  const weakest = weakestProgress(progress).filter((p) => wordById.has(p.wordId));

  return (
    <>
      <header className="topbar">
        <h1>ההתקדמות שלי</h1>
      </header>

      <div className="stat-row">
        <div className="stat">
          <div className="num">{progress.length}</div>
          <div className="lbl">התחלת מתוך {words.length}</div>
        </div>
        <div className="stat">
          <div className="num">{known}</div>
          <div className="lbl">בשלב השימוש</div>
        </div>
        <div className="stat">
          <div className="num">{mastered}</div>
          <div className="lbl">בשליטה מלאה</div>
        </div>
      </div>

      <h3 className="section-title">זכירה · 30 הימים האחרונים</h3>
      <section className="card">
        {retention === null ? (
          <p className="muted small" style={{ margin: 0 }}>
            אחוז הזכירה יופיע אחרי החזרות הראשונות — יום־יומיים אחרי שלומדים מילים חדשות.
          </p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
            <div style={{ fontSize: 44, fontWeight: 750, lineHeight: 1 }}>{retention}%</div>
            <div className="small muted" style={{ paddingBottom: 4 }}>
              מתוך {graded.length} חזרות זכרת נכון
              <br />
              <span className="faint">היעד הוא בערך 90%. למדת ב־{activeDays} מתוך 30 הימים האחרונים.</span>
            </div>
          </div>
        )}
      </section>

      <h3 className="section-title">חזרות צפויות · 14 הימים הקרובים</h3>
      <section className="card">
        <Forecast days={forecast} />
      </section>

      <h3 className="section-title">דיוק לפי סוג כרטיס · 30 יום</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {byType.map(({ t, n, pct }) => (
          <div key={t} className="setting" style={{ minHeight: 48 }}>
            <span className="label small">
              {t}. {CARD_TYPE_LABEL[t]}
              {t >= 3 && <small>שלב השימוש</small>}
            </span>
            <span className="small muted">{pct === null ? '—' : `${pct}%`}</span>
            <span className="tiny faint" style={{ minWidth: 56, textAlign: 'end' }}>
              {n === 1 ? 'תשובה אחת' : `${n} תשובות`}
            </span>
          </div>
        ))}
      </section>

      <h3 className="section-title">המילים הכי מאתגרות</h3>
      {weakest.length ? (
        <>
          <div className="list">
            {weakest.map((p) => {
              const w = wordById.get(p.wordId)!;
              return (
                <button key={p.wordId} className="list-item" onClick={() => go('word', p.wordId)}>
                  <span className="main">
                    <span className="w">
                      <bdi lang="en">{w.word}</bdi>
                      <span className="w-he"> · {shortHe(w)}</span>
                    </span>
                    <span className="d" style={{ display: 'block' }}>
                      {p.mistakes === 1 ? 'טעות אחת' : `${p.mistakes} טעויות`} · סיכוי לזכור כרגע {Math.round(retrievability(p.card) * 100)}%
                    </span>
                  </span>
                  <span className="chev">‹</span>
                </button>
              );
            })}
          </div>
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => go('session', 'weak')}>
            לתרגל אותן עכשיו
          </button>
          <p className="tiny faint center">תרגול נוסף לא משנה את לוח החזרות שלך.</p>
        </>
      ) : (
        <section className="card muted small">עדיין אין מילים מאתגרות. מילים שיהיו לך קשות יופיעו כאן.</section>
      )}
      <p className="tiny faint center" style={{ marginTop: 20 }}>
        יום הלימוד מתחלף ב־4 לפנות בוקר
      </p>
    </>
  );
}

/** Single-series column chart: 4px rounded caps on a shared baseline, tap a column for its value, plus a table view. */
function Forecast({ days }: { days: { label: string; date: string; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(...days.map((d) => d.count), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const peak = days.reduce((a, d, i) => (d.count > days[a].count ? i : a), 0);
  const total = days.reduce((s, d) => s + d.count, 0);

  if (!total) return <p className="muted small" style={{ margin: 0 }}>עדיין אין חזרות מתוכננות — התחילו ללמוד מילים כדי לראות תחזית.</p>;

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {active === null ? (
          <>
            {total} חזרות בשבועיים · העמוס ביותר: <strong style={{ color: 'var(--ink)' }}>{days[peak].label}</strong> ({days[peak].count})
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--ink)' }}>{days[active].date}</strong>: {days[active].count} חזרות
          </>
        )}
      </div>
      {table ? (
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 0' }}>{d.date}</td>
                <td style={{ textAlign: 'end' }}>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="fc" role="img" aria-label={`חזרות צפויות בכל יום בשבועיים הקרובים. ${days.map((d) => `${d.label}: ${d.count}`).join(', ')}`}>
          <div className="fc-grid" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="fc-tick" style={{ bottom: `${(t / top) * 100}%` }}>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <div className="fc-cols">
            {days.map((d, i) => (
              <button
                key={i}
                type="button"
                className={'fc-col' + (active === i ? ' on' : '')}
                onClick={() => setActive(active === i ? null : i)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                aria-label={`${d.date}: ${d.count} חזרות`}
              >
                <span className="fc-bar" style={{ height: d.count ? `max(2px, ${(d.count / top) * 100}%)` : 0 }} />
              </button>
            ))}
          </div>
          <div className="fc-labels" aria-hidden>
            {days.map((d, i) => (
              <span key={i}>{i % 2 === 0 ? d.label : ''}</span>
            ))}
          </div>
        </div>
      )}
      <button className="btn small ghost" style={{ marginTop: 8, paddingInline: 0 }} onClick={() => setTable(!table)}>
        {table ? 'להציג כגרף' : 'להציג כטבלה'}
      </button>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { dayKey, endOfStudyDay } from '../lib/dates';
import { statusOf } from '../lib/status';
import { retrievability } from '../lib/srs';
import { weakestProgress } from '../lib/session';
import { CARD_TYPE_NAMES } from '../lib/cards';
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
        label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' }),
        date: d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }),
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
        <h1>Stats</h1>
      </header>

      <div className="stat-row">
        <div className="stat">
          <div className="num">{progress.length}</div>
          <div className="lbl">started of {words.length}</div>
        </div>
        <div className="stat">
          <div className="num">{known}</div>
          <div className="lbl">can produce</div>
        </div>
        <div className="stat">
          <div className="num">{mastered}</div>
          <div className="lbl">mastered</div>
        </div>
      </div>

      <h3 className="section-title">Retention · last 30 days</h3>
      <section className="card">
        {retention === null ? (
          <p className="muted small" style={{ margin: 0 }}>
            Retention appears after your first scheduled reviews (a day or two after learning new words).
          </p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
            <div style={{ fontSize: 44, fontWeight: 750, lineHeight: 1 }}>{retention}%</div>
            <div className="small muted" style={{ paddingBottom: 4 }}>
              of {graded.length} scheduled reviews recalled correctly
              <br />
              <span className="faint">FSRS aims for about 90%. Studied on {activeDays} of the last 30 days.</span>
            </div>
          </div>
        )}
      </section>

      <h3 className="section-title">Upcoming reviews · next 14 days</h3>
      <section className="card">
        <Forecast days={forecast} />
      </section>

      <h3 className="section-title">Accuracy by card type · 30 days</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {byType.map(({ t, n, pct }) => (
          <div key={t} className="setting" style={{ minHeight: 48 }}>
            <span className="label small">
              {t}. {CARD_TYPE_NAMES[t]}
              {t >= 3 && <small>production</small>}
            </span>
            <span className="small muted">{pct === null ? '—' : `${pct}%`}</span>
            <span className="tiny faint" style={{ minWidth: 48, textAlign: 'right' }}>
              {n} {n === 1 ? 'answer' : 'answers'}
            </span>
          </div>
        ))}
      </section>

      <h3 className="section-title">Weakest words</h3>
      {weakest.length ? (
        <>
          <div className="list">
            {weakest.map((p) => {
              const w = wordById.get(p.wordId)!;
              return (
                <button key={p.wordId} className="list-item" onClick={() => go('word', p.wordId)}>
                  <span className="main">
                    <span className="w">{w.word}</span>
                    <span className="d" style={{ display: 'block' }}>
                      {p.mistakes} {p.mistakes === 1 ? 'mistake' : 'mistakes'} · {Math.round(retrievability(p.card) * 100)}% recall now
                    </span>
                  </span>
                  <span className="faint">›</span>
                </button>
              );
            })}
          </div>
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => go('session', 'weak')}>
            Practise these now
          </button>
          <p className="tiny faint center">Extra practice doesn’t change your review schedule.</p>
        </>
      ) : (
        <section className="card muted small">No weak words yet. Mistakes you make will show up here.</section>
      )}
      <p className="tiny faint center" style={{ marginTop: 20 }}>
        Day {dayKey()} · a study day starts at 4am
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

  if (!total) return <p className="muted small" style={{ margin: 0 }}>Nothing scheduled yet — start learning words to see your forecast.</p>;

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {active === null ? (
          <>
            {total} reviews in 14 days · busiest: <strong style={{ color: 'var(--ink)' }}>{days[peak].label}</strong> ({days[peak].count})
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--ink)' }}>{days[active].date}</strong>: {days[active].count} reviews
          </>
        )}
      </div>
      {table ? (
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 0' }}>{d.date}</td>
                <td style={{ textAlign: 'right' }}>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="fc" role="img" aria-label={`Reviews due per day for the next 14 days. ${days.map((d) => `${d.label}: ${d.count}`).join(', ')}`}>
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
                aria-label={`${d.date}: ${d.count} reviews`}
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
      <button className="btn small ghost" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => setTable(!table)}>
        {table ? 'Show chart' : 'Show as table'}
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

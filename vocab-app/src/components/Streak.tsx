import { computeStreak, recentDays } from '../lib/store';
import { formatDate } from '../strings';
import type { DayLog } from '../types';
import { FlameIcon } from './Icons';

const dateOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Days in a row, the last week at a glance, and what keeps the streak alive today. */
export function StreakCard({ days }: { days: DayLog[] }) {
  const { current, best, todayDone } = computeStreak(days);
  const week = recentDays(days, 7);
  const message = todayDone
    ? 'הרצף נשמר להיום. נתראה מחר!'
    : current > 0
      ? `סיימו את האימון היום כדי להמשיך את הרצף של ${current === 1 ? 'יום אחד' : `${current} ימים`}.`
      : 'סיימו את האימון היום כדי להתחיל רצף.';

  return (
    <section className={'card streak' + (todayDone ? ' done' : '')}>
      <div className="streak-top">
        <span className="streak-flame" aria-hidden>
          <FlameIcon width={26} height={26} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="streak-num">{current === 1 ? 'יום אחד ברצף' : `${current} ימים ברצף`}</div>
          <div className="small muted">{message}</div>
        </div>
      </div>
      <ol className="week" aria-label="השבוע האחרון">
        {week.map((d) => (
          <li key={d.day} className={(d.met ? 'met' : '') + (d.today ? ' today' : '')} aria-label={`${formatDate(dateOf(d.day), { weekday: 'long' })}: ${d.met ? 'הושלם' : 'לא הושלם'}`}>
            <span className="dot" />
            <span className="wd">{formatDate(dateOf(d.day), { weekday: 'narrow' })}</span>
          </li>
        ))}
      </ol>
      {best > current && <div className="tiny faint">השיא שלך: {best} ימים ברצף</div>}
    </section>
  );
}

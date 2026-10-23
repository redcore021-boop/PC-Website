/** The easy-to-hard path every word follows. With `counts`, shows how many of your words are at each step. */
export function StageLadder({ counts }: { counts?: { recognise: number; recall: number; use: number; mastered: number } }) {
  const steps = [
    { key: 'recognise', title: 'מזהים', sub: 'בוחרים את המילה לפי ההגדרה שלה' },
    { key: 'recall', title: 'נזכרים', sub: 'משלימים אותה במשפט אמיתי' },
    { key: 'use', title: 'משתמשים', sub: 'מקלידים אותה · בוחרים את המילה המדויקת · כותבים משפט משלכם' },
    { key: 'mastered', title: 'שולטים', sub: 'משתמשים בה נכון וזוכרים אותה לאורך שבועות' },
  ] as const;
  return (
    <ol className="ladder">
      {steps.map((s, i) => (
        <li key={s.key}>
          <span className="ladder-num">{i + 1}</span>
          <span className="ladder-body">
            <strong>{s.title}</strong>
            <span>{s.sub}</span>
          </span>
          {counts && <span className="ladder-count">{counts[s.key]}</span>}
        </li>
      ))}
    </ol>
  );
}

/** The easy-to-hard path every word follows. With `counts`, shows how many of your words are at each step. */
export function StageLadder({ counts }: { counts?: { recognise: number; recall: number; use: number; mastered: number } }) {
  const steps = [
    { key: 'recognise', title: 'Recognise', sub: 'Pick the word from its meaning' },
    { key: 'recall', title: 'Recall', sub: 'Complete a real sentence' },
    { key: 'use', title: 'Use', sub: 'Type it · choose the precise word · write your own sentence' },
    { key: 'mastered', title: 'Mastered', sub: 'Used correctly and remembered for weeks' },
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

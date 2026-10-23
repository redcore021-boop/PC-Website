/** Edit distance counting an adjacent transposition ("recieve") as one edit. */
export function levenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const FILLERS = new Set(['someone', "someone's", 'something', 'sb', 'sth', 'one', "one's"]);

/** Lowercase, straighten quotes, drop punctuation and placeholder words, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z' -]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLERS.has(w))
    .join(' ')
    .replace(/^(a|an|the|to) /, '')
    .trim();
}

export type MatchResult = 'exact' | 'typo' | 'wrong';

/** Allowed edits scale with length: 0 up to 4 letters, 1 up to 7 letters, 2 beyond. */
export function allowedTypos(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

export function matchAnswer(input: string, target: string, alternatives: string[] = []): MatchResult {
  const a = normalize(input);
  if (!a) return 'wrong';
  let best: MatchResult = 'wrong';
  for (const t of [target, ...alternatives]) {
    const b = normalize(t);
    if (a === b) return 'exact';
    if (levenshtein(a, b) <= allowedTypos(b.length)) best = 'typo';
  }
  return best;
}

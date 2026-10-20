/** Number formatting used across the UI. */

export function fmtInt(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

/** One decimal at most, without trailing zeros: 12 → "12", 12.34 → "12.3". */
export function fmt1(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '0';
  return String(Math.round(n * 10) / 10);
}

/** Parse a user-typed number, accepting a comma as decimal separator. */
export function parseNum(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

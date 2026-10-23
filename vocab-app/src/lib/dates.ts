/** Local calendar day as YYYY-MM-DD. A study day rolls over at 4am so late-night sessions count for the evening. */
export function dayKey(d: Date | number = new Date(), rolloverHour = 4): string {
  const t = new Date(typeof d === 'number' ? d : d.getTime());
  t.setHours(t.getHours() - rolloverHour);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1, d + n, 12);
  return dayKey(t, 0);
}

/** End of the current study day (next 4am), used as the cut-off for "due today". */
export function endOfStudyDay(now = new Date(), rolloverHour = 4): Date {
  const t = new Date(now);
  if (t.getHours() >= rolloverHour) t.setDate(t.getDate() + 1);
  t.setHours(rolloverHour, 0, 0, 0);
  return t;
}

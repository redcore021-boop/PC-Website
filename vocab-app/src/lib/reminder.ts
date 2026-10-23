/**
 * Daily reminder without a server: a repeating calendar event with an alert.
 * The phone's calendar fires it every day, even when the app is closed.
 */

const TITLE = 'Lexicon · אימון אנגלית יומי';
const DETAILS = 'כמה דקות של מילים באנגלית — כדי לשמור על הרצף.';

/** The app's own address, so the event links straight back to it. */
export function appUrl(): string {
  return location.href.split('#')[0];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date-time as YYYYMMDDTHHMMSS (no zone: "floating", i.e. the phone's local time). */
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** The first reminder: today if the time is still ahead, otherwise tomorrow. */
export function firstOccurrence(time: string, now = new Date()): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

export function icsText(time: string, url = appUrl(), now = new Date()): string {
  const start = firstOccurrence(time, now);
  const end = new Date(+start + 10 * 60e3);
  const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lexicon//Daily reminder//HE',
    'BEGIN:VEVENT',
    `UID:lexicon-daily-${utc}@lexicon`,
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAILS}\\n${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function googleCalendarUrl(time: string, url = appUrl(), now = new Date()): string {
  const start = firstOccurrence(time, now);
  const end = new Date(+start + 10 * 60e3);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    details: `${DETAILS}\n${url}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    recur: 'RRULE:FREQ=DAILY',
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

export function downloadIcs(time: string) {
  const blob = new Blob([icsText(time)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lexicon-reminder.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

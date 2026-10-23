import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db, BACKUP_TABLES } from '../lib/db';
import { downloadBackup, parseBackup, restoreBackup } from '../lib/backup';
import { hasVoice, speak, speechSupported } from '../lib/speech';
import { ENABLED_FEATURES } from '../features';
import { formatDate } from '../strings';
import type { Settings } from '../types';
import { ReminderSetup } from '../components/Reminder';

function Stepper({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" dir="ltr">
      <button type="button" aria-label={`פחות ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button type="button" aria-label={`יותר ${label}`} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const lastBackup = useLiveQuery(() => db.kv.get('lastBackup').then((r) => r?.value as number | undefined), [], undefined);
  const counts = useLiveQuery(async () => ({ words: await db.progress.count(), custom: await db.customWords.count() }), [], undefined);
  const set = (patch: Partial<Settings>) => void updateSettings(patch);

  const onImport = async (file: File) => {
    setBusy(true);
    try {
      const data = parseBackup(await file.text());
      const when = new Date(data.exportedAt).toLocaleString('he-IL');
      if (!confirm(`להחליף את כל ההתקדמות הנוכחית בגיבוי מ־${when}? אי אפשר לבטל את הפעולה.`)) return;
      const r = await restoreBackup(data);
      toast(`שוחזרו ${r.words} מילים ו־${r.reviews} תשובות`);
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    if (!confirm('למחוק את כל ההתקדמות, המילים שהוספת וההגדרות במכשיר הזה?')) return;
    if (!confirm('בטוח? כדאי לייצא גיבוי קודם, למקרה שתרצו לשחזר.')) return;
    await db.transaction('rw', BACKUP_TABLES.map((n) => db.table(n)), async () => {
      for (const n of BACKUP_TABLES) await db.table(n).clear();
    });
    location.hash = '/';
    location.reload();
  };

  return (
    <>
      <header className="topbar">
        <h1>הגדרות</h1>
      </header>

      <h3 className="section-title">היעד היומי</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="setting">
          <div className="label">
            מילים חדשות ביום
            <small>בין 5 ל־15 זה קצב שאפשר להחזיק לאורך זמן</small>
          </div>
          <Stepper label="מילים חדשות" value={settings.newPerDay} min={0} max={50} step={1} onChange={(n) => set({ newPerDay: n })} />
        </div>
        <div className="setting">
          <div className="label">
            מקסימום חזרות ביום
            <small>חזרות עודפות יחכו למחר</small>
          </div>
          <Stepper label="חזרות" value={settings.reviewsPerDay} min={20} max={500} step={10} onChange={(n) => set({ reviewsPerDay: n })} />
        </div>
      </section>

      <h3 className="section-title">תזכורת יומית</h3>
      <section className="card">
        <ReminderSetup />
      </section>

      <h3 className="section-title">תצוגה</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="setting">
          <div className="label">ערכת צבעים</div>
          <div className="segmented">
            {(
              [
                ['dark', 'כהה'],
                ['light', 'בהירה'],
                ['system', 'אוטומטית'],
              ] as const
            ).map(([t, label]) => (
              <button key={t} aria-pressed={settings.theme === t} onClick={() => set({ theme: t })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {ENABLED_FEATURES.audio && speechSupported() && (
          <>
            <div className="setting">
              <div className="label">
                הגייה
                <small>{hasVoice(settings.accent) ? 'משתמשת בקולות המובנים בטלפון' : 'אין בטלפון קול למבטא הזה'}</small>
              </div>
              <div className="segmented">
                {(['en-US', 'en-GB'] as const).map((a) => (
                  <button
                    key={a}
                    aria-pressed={settings.accent === a}
                    onClick={() => {
                      set({ accent: a });
                      speak('ubiquitous', a);
                    }}
                  >
                    {a === 'en-US' ? 'אמריקאית' : 'בריטית'}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <div className="label">
                השמעה אוטומטית
                <small>משמיעה את המילה כשמופיעה מילה חדשה או תשובה</small>
              </div>
              <Switch label="השמעה אוטומטית" checked={settings.autoplayAudio} onChange={(v) => set({ autoplayAudio: v })} />
            </div>
          </>
        )}
      </section>

      <h3 className="section-title">גיבוי</h3>
      <section className="card">
        <p className="note small" style={{ marginTop: 0 }}>
          הכול נשמר רק במכשיר הזה. כדאי לייצא קובץ גיבוי מדי פעם (למשל ל־iCloud Drive או לגוגל דרייב) כדי לא לאבד התקדמות.
          {counts && ` כרגע יש ${counts.words} מילים בלמידה${counts.custom ? ` ו־${counts.custom} מילים שהוספת` : ''}.`}
        </p>
        <p className="tiny faint">גיבוי אחרון: {lastBackup ? formatDate(lastBackup, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'עדיין לא'}</p>
        <div className="stack">
          <button className="btn primary block" onClick={() => downloadBackup().then(() => toast('הגיבוי יוצא'))}>
            ייצוא גיבוי
          </button>
          <button className="btn block" disabled={busy} onClick={() => fileRef.current?.click()}>
            שחזור מגיבוי…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </section>

      <h3 className="section-title">התקנה בטלפון</h3>
      <section className="card note small">
        <p style={{ marginTop: 0 }}>
          <strong>iPhone (Safari):</strong> כפתור השיתוף ← <em>הוסף למסך הבית</em>.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Android (Chrome):</strong> ⋮ ← <em>התקנת אפליקציה</em>. אחרי הכניסה הראשונה היא עובדת גם בלי אינטרנט.
        </p>
      </section>

      <h3 className="section-title">מחיקה</h3>
      <section className="card">
        <button className="btn danger block" onClick={reset}>
          למחוק את כל הנתונים במכשיר
        </button>
      </section>
      <p className="center tiny faint" style={{ marginTop: 24 }}>
        Lexicon · חינם, בלי אינטרנט, בלי הרשמה
      </p>
    </>
  );
}

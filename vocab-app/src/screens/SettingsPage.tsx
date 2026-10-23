import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db, BACKUP_TABLES } from '../lib/db';
import { downloadBackup, parseBackup, restoreBackup } from '../lib/backup';
import { hasVoice, speak, speechSupported } from '../lib/speech';
import { ENABLED_FEATURES } from '../features';
import type { Settings } from '../types';

function Stepper({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + step))}>
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
      const when = new Date(data.exportedAt).toLocaleString();
      if (!confirm(`Replace ALL current progress with the backup from ${when}? This cannot be undone.`)) return;
      const r = await restoreBackup(data);
      toast(`Restored ${r.words} words and ${r.reviews} answers`);
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    if (!confirm('Delete all your progress, added words and settings on this device?')) return;
    if (!confirm('Really delete everything? Export a backup first if you might want it back.')) return;
    await db.transaction('rw', BACKUP_TABLES.map((n) => db.table(n)), async () => {
      for (const n of BACKUP_TABLES) await db.table(n).clear();
    });
    location.hash = '/';
    location.reload();
  };

  return (
    <>
      <header className="topbar">
        <h1>Settings</h1>
      </header>

      <h3 className="section-title">Daily goal</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="setting">
          <div className="label">
            New words per day
            <small>About 5–15 is sustainable</small>
          </div>
          <Stepper label="new words" value={settings.newPerDay} min={0} max={50} step={1} onChange={(n) => set({ newPerDay: n })} />
        </div>
        <div className="setting">
          <div className="label">
            Maximum reviews per day
            <small>Overdue cards wait for tomorrow</small>
          </div>
          <Stepper label="reviews" value={settings.reviewsPerDay} min={20} max={500} step={10} onChange={(n) => set({ reviewsPerDay: n })} />
        </div>
      </section>

      <h3 className="section-title">Display</h3>
      <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="setting">
          <div className="label">
            Always show Hebrew
            <small>Off: tap to reveal the translation</small>
          </div>
          <Switch label="Always show Hebrew" checked={settings.showHebrew} onChange={(v) => set({ showHebrew: v })} />
        </div>
        <div className="setting">
          <div className="label">Theme</div>
          <div className="segmented">
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button key={t} aria-pressed={settings.theme === t} onClick={() => set({ theme: t })}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {ENABLED_FEATURES.audio && speechSupported() && (
          <>
            <div className="setting">
              <div className="label">
                Pronunciation
                <small>{hasVoice(settings.accent) ? 'Uses your device’s built-in voices' : 'No voice for this accent on this device'}</small>
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
                    {a === 'en-US' ? 'US' : 'UK'}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <div className="label">
                Play words automatically
                <small>When a new word or answer appears</small>
              </div>
              <Switch label="Play words automatically" checked={settings.autoplayAudio} onChange={(v) => set({ autoplayAudio: v })} />
            </div>
          </>
        )}
      </section>

      <h3 className="section-title">Backup</h3>
      <section className="card">
        <p className="note small" style={{ marginTop: 0 }}>
          Everything is stored only on this device. Export a backup file regularly (e.g. to iCloud Drive or Google Drive) so you never lose
          progress. {counts && `You have ${counts.words} words in progress${counts.custom ? ` and ${counts.custom} added words` : ''}.`}
        </p>
        <p className="tiny faint">Last backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'never'}</p>
        <div className="stack">
          <button className="btn primary block" onClick={() => downloadBackup().then(() => toast('Backup exported'))}>
            Export backup
          </button>
          <button className="btn block" disabled={busy} onClick={() => fileRef.current?.click()}>
            Import backup…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </section>

      <h3 className="section-title">Install on your phone</h3>
      <section className="card note small">
        <p style={{ marginTop: 0 }}>
          <strong>iPhone (Safari):</strong> tap the Share button → <em>Add to Home Screen</em>.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Android (Chrome):</strong> tap ⋮ → <em>Install app</em> (or <em>Add to Home screen</em>). After the first visit it works offline.
        </p>
      </section>

      <h3 className="section-title">Danger zone</h3>
      <section className="card">
        <button className="btn danger block" onClick={reset}>
          Delete all data on this device
        </button>
      </section>
      <p className="center tiny faint" style={{ marginTop: 24 }}>
        Lexicon · free, offline, no account
      </p>
    </>
  );
}

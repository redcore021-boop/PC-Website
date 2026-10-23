import type { Progress } from '../types';
import { BACKUP_TABLES, db } from './db';
import { reviveCard } from './srs';

export const BACKUP_FORMAT = 'lexicon-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  tables: Record<(typeof BACKUP_TABLES)[number], unknown[]>;
}

export async function createBackup(): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const name of BACKUP_TABLES) tables[name] = await db.table(name).toArray();
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), tables };
}

export function backupFileName(d = new Date()): string {
  return `lexicon-backup-${d.toISOString().slice(0, 10)}.json`;
}

export async function downloadBackup(): Promise<void> {
  const data = await createBackup();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], backupFileName(), { type: 'application/json' });
  // On phones the share sheet is the friendliest way to save to Files / Drive.
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'גיבוי Lexicon' });
      await db.kv.put({ key: 'lastBackup', value: Date.now() });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  await db.kv.put({ key: 'lastBackup', value: Date.now() });
}

export function parseBackup(text: string): Backup {
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('הקובץ הזה אינו קובץ JSON תקין.');
  }
  if (data?.format !== BACKUP_FORMAT || !data.tables || typeof data.tables !== 'object') {
    throw new Error('זה לא קובץ גיבוי של Lexicon.');
  }
  for (const name of BACKUP_TABLES) {
    const rows = data.tables[name];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`הטבלה "${name}" בקובץ הגיבוי פגומה.`);
  }
  return data;
}

/** Replace all local data with the backup's contents. */
export async function restoreBackup(data: Backup): Promise<{ words: number; reviews: number }> {
  const progress = ((data.tables.progress ?? []) as Progress[]).map((p) => ({ ...p, card: reviveCard(p.card) }));
  await db.transaction('rw', BACKUP_TABLES.map((n) => db.table(n)), async () => {
    for (const name of BACKUP_TABLES) {
      const table = db.table(name);
      await table.clear();
      const rows = name === 'progress' ? progress : (data.tables[name] ?? []);
      if (rows.length) await table.bulkPut(rows);
    }
  });
  return { words: progress.length, reviews: (data.tables.reviews ?? []).length };
}

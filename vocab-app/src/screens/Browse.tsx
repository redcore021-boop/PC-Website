import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { statusOf, STATUS_LABEL, type WordStatus } from '../lib/status';
import { rootByKey, roots, shortHe, simpleDef, themeByKey, themes } from '../lib/words';
import { go } from '../lib/router';
import { ENABLED_FEATURES } from '../features';
import type { WordEntry } from '../types';

const FILTERS: (WordStatus | 'all')[] = ['all', 'new', 'learning', 'known', 'mastered'];

export function Browse({ tab }: { tab?: string }) {
  const { words } = useApp();
  const progress = useLiveQuery(() => db.progress.toArray(), [], []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<WordStatus | 'all'>('all');
  const byId = useMemo(() => new Map(progress.map((p) => [p.wordId, p])), [progress]);

  const themeKey = tab?.startsWith('theme-') ? tab.slice(6) : undefined;
  const rootKey = tab?.startsWith('root-') ? tab.slice(5) : undefined;
  const view = tab === 'themes' || tab === 'roots' ? tab : 'all';

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return words
      .filter((w) => !themeKey || w.themes.includes(themeKey))
      .filter((w) => !rootKey || w.root === rootKey)
      .filter((w) => filter === 'all' || statusOf(byId.get(w.id)) === filter)
      .filter(
        (w) =>
          !needle ||
          w.word.toLowerCase().includes(needle) ||
          simpleDef(w).toLowerCase().includes(needle) ||
          w.def.toLowerCase().includes(needle) ||
          w.he.includes(needle),
      )
      .sort((a, b) => a.word.replace(/^(a|an|the) /i, '').localeCompare(b.word.replace(/^(a|an|the) /i, '')));
  }, [words, q, filter, byId, themeKey, rootKey]);

  const title = themeKey ? (themeByKey.get(themeKey)?.he ?? themeKey) : rootKey ? 'שורש' : 'המילים שלי';

  return (
    <>
      <header className="topbar">
        {(themeKey || rootKey) && (
          <button className="icon-btn" aria-label="חזרה" onClick={() => go('browse', themeKey ? 'themes' : 'roots')}>
            <span className="chev">›</span>
          </button>
        )}
        <h1>
          {title}
          {rootKey && (
            <bdi className="en" lang="en" style={{ marginInlineStart: 8 }}>
              {rootByKey.get(rootKey)?.form ?? rootKey}
            </bdi>
          )}
        </h1>
        <span className="faint small">{list.length}</span>
      </header>

      {ENABLED_FEATURES.themes && !themeKey && !rootKey && (
        <div className="segmented" style={{ marginBottom: 12 }}>
          {(['all', 'themes', 'roots'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => go('browse', v === 'all' ? '' : v)}>
              {v === 'all' ? 'כל המילים' : v === 'themes' ? 'לפי נושא' : 'לפי שורש'}
            </button>
          ))}
        </div>
      )}

      {rootKey && rootByKey.get(rootKey) && (
        <p className="muted" style={{ marginTop: 0 }}>
          פירוש: {rootByKey.get(rootKey)!.he} · מקור: <bdi lang="en">{rootByKey.get(rootKey)!.origin}</bdi>
        </p>
      )}

      {view === 'themes' ? (
        <Groups
          items={themes.map((t) => ({ key: t.key, label: t.he, sub: '', words: words.filter((w) => w.themes.includes(t.key)) }))}
          prefix="theme-"
        />
      ) : view === 'roots' ? (
        <Groups
          items={roots.map((r) => ({ key: r.key, label: r.form, sub: r.he, words: words.filter((w) => w.root === r.key), en: true }))}
          prefix="root-"
        />
      ) : (
        <>
          <input
            className="search"
            type="search"
            dir="auto"
            placeholder="חיפוש מילה, הגדרה או תרגום…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <div className="row wrap" style={{ margin: '12px 0', gap: 6 }}>
            {FILTERS.map((f) => (
              <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'הכול' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          {list.length ? (
            <WordList words={list} statusFor={(w) => statusOf(byId.get(w.id))} />
          ) : (
            <div className="empty">לא נמצאו מילים מתאימות.</div>
          )}
        </>
      )}
    </>
  );
}

export function WordList({ words, statusFor }: { words: WordEntry[]; statusFor: (w: WordEntry) => WordStatus }) {
  return (
    <div className="list">
      {words.map((w) => {
        const s = statusFor(w);
        return (
          <button key={w.id} className="list-item" dir="ltr" onClick={() => go('word', w.id)}>
            <span className={'dot ' + s} title={STATUS_LABEL[s]} />
            <span className="main" lang="en" style={{ textAlign: 'left' }}>
              <span className="w-row">
                <span className="w">{w.word}</span>
                <span className="w-he" dir="rtl" lang="he">
                  {shortHe(w)}
                </span>
              </span>
              <span className="d" style={{ display: 'block' }}>
                {simpleDef(w)}
              </span>
            </span>
            <span className="chev">›</span>
          </button>
        );
      })}
    </div>
  );
}

function Groups({ items, prefix }: { items: { key: string; label: string; sub: string; words: WordEntry[]; en?: boolean }[]; prefix: string }) {
  return (
    <div className="list">
      {items
        .filter((i) => i.words.length)
        .map((i) => (
          <button key={i.key} className="list-item" onClick={() => go('browse', prefix + i.key)}>
            <span className="main">
              <span className="w" style={i.en ? undefined : { fontFamily: 'var(--f-body)' }}>
                {i.en ? (
                  <bdi lang="en" dir="ltr">
                    {i.label}
                  </bdi>
                ) : (
                  i.label
                )}
                {i.sub && <span className="muted small" style={{ fontFamily: 'var(--f-body)', fontWeight: 500 }}> · {i.sub}</span>}
              </span>
              <span className="d" style={{ display: 'block', textAlign: 'right' }} dir="ltr" lang="en">
                {i.words
                  .slice(0, 4)
                  .map((w) => w.word)
                  .join(', ')}
                {i.words.length > 4 ? '…' : ''}
              </span>
            </span>
            <span className="chip">{i.words.length}</span>
          </button>
        ))}
    </div>
  );
}

import { useState } from 'react';
import type { WordEntry } from '../types';
import { useApp } from '../state';
import { rootByKey, themeByKey } from '../lib/words';
import { go } from '../lib/router';
import { AudioButton } from './AudioButton';

/** Hebrew stays hidden until tapped (unless the user turned on "always show Hebrew"). */
export function HebrewHint({ text, resetKey }: { text: string; resetKey?: string }) {
  const { settings } = useApp();
  const [shownFor, setShownFor] = useState<string | undefined>(undefined);
  const shown = settings.showHebrew || shownFor === (resetKey ?? text);
  if (!text) return null;
  return (
    <button
      type="button"
      className={'he-reveal' + (shown ? ' shown' : '')}
      onClick={() => setShownFor(shown && !settings.showHebrew ? undefined : (resetKey ?? text))}
      aria-label={shown ? 'Hebrew translation' : 'Show Hebrew translation'}
    >
      {shown ? <span className="he" lang="he">{text}</span> : <>עברית · tap to reveal</>}
    </button>
  );
}

/** Render an example with its [target] highlighted. */
export function Example({ text }: { text: string }) {
  const parts = text.split(/\[([^\]]+)\]/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export function WordHeader({ word, size }: { word: WordEntry; size?: 'sm' }) {
  return (
    <div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h2 className={'headword' + (size ? ' ' + size : '')} style={{ flex: 1 }}>
          {word.word}
        </h2>
        <AudioButton text={word.word} />
      </div>
      <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
        {word.ipa && <span className="ipa">/{word.ipa}/</span>}
        <span className="pos">{word.pos}</span>
      </div>
    </div>
  );
}

const TIER_LABEL = { 1: 'Core advanced', 2: 'Advanced', 3: 'Rare / literary' } as const;

/** The full dictionary entry. `brief` shows just enough for answer feedback. */
export function WordEntryView({ word, brief = false }: { word: WordEntry; brief?: boolean }) {
  const root = word.root ? rootByKey.get(word.root) : undefined;
  return (
    <div>
      <WordHeader word={word} size={brief ? 'sm' : undefined} />
      <p className="def">{word.def}</p>
      <HebrewHint text={word.he} resetKey={word.id} />
      {brief ? (
        word.ex[0] && (
          <p className="note" style={{ marginTop: 12 }}>
            <Example text={word.ex[0]} />
          </p>
        )
      ) : (
        <>
          <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
            <span className="chip accent">{word.reg}</span>
            <span className="chip">{TIER_LABEL[word.tier]}</span>
            {word.custom && <span className="chip good">added by you</span>}
          </div>
          {word.family.length > 0 && (
            <>
              <div className="field-label">Word family</div>
              <p className="note">{word.family.join(' · ')}</p>
            </>
          )}
          <div className="field-label">Examples</div>
          <ul className="examples">
            {word.ex.map((e, i) => (
              <li key={i} className="with-audio">
                <span>
                  <Example text={e} />
                </span>
                <AudioButton small text={e.replace(/[[\]]/g, '')} label="Play example" />
              </li>
            ))}
          </ul>
          {word.col.length > 0 && (
            <>
              <div className="field-label">Collocations</div>
              <div className="colls">
                {word.col.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
          {word.nuance && (
            <>
              <div className="field-label">Nuance{word.syn.length ? ` vs. ${word.syn.slice(0, 3).join(', ')}` : ''}</div>
              <p className="note">{word.nuance}</p>
            </>
          )}
          {word.ety && (
            <>
              <div className="field-label">Origin</div>
              <p className="note">{word.ety}</p>
            </>
          )}
          {(root || word.themes.length > 0) && (
            <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
              {root && (
                <button className="chip" onClick={() => go('browse', 'root-' + root.key)}>
                  root {root.form} · {root.meaning}
                </button>
              )}
              {word.themes.map((t) => (
                <button key={t} className="chip" onClick={() => go('browse', 'theme-' + t)}>
                  {themeByKey.get(t)?.label ?? t}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

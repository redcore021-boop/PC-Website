import { useState } from 'react';
import type { WordEntry } from '../types';
import { useApp } from '../state';
import { rootByKey, themeByKey } from '../lib/words';
import { go } from '../lib/router';
import { REGISTER_LABEL, TIER_LABEL } from '../strings';
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
      dir="rtl"
      className={'he-reveal' + (shown ? ' shown' : '')}
      onClick={() => setShownFor(shown && !settings.showHebrew ? undefined : (resetKey ?? text))}
      aria-label={shown ? 'תרגום לעברית' : 'הצגת התרגום לעברית'}
    >
      {shown ? (
        <span className="he" lang="he">
          {text}
        </span>
      ) : (
        <>הצגת תרגום</>
      )}
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
    <div dir="ltr">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h2 className={'headword' + (size ? ' ' + size : '')} style={{ flex: 1 }} lang="en">
          {word.word}
        </h2>
        <AudioButton text={word.word} />
      </div>
      <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
        {word.ipa && <span className="ipa">/{word.ipa}/</span>}
        <span className="pos" lang="en">
          {word.pos}
        </span>
      </div>
    </div>
  );
}

/** A Hebrew field label inside the English card. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="field-label" dir="rtl" style={{ textAlign: 'left' }}>
      {children}
    </div>
  );
}

/** The full dictionary entry. `brief` shows just enough for answer feedback. */
export function WordEntryView({ word, brief = false }: { word: WordEntry; brief?: boolean }) {
  const root = word.root ? rootByKey.get(word.root) : undefined;
  return (
    <div dir="ltr" lang="en">
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
            <span className="chip accent">{REGISTER_LABEL[word.reg]}</span>
            <span className="chip">{TIER_LABEL[word.tier]}</span>
            {word.custom && <span className="chip good">הוספת בעצמך</span>}
          </div>
          {word.family.length > 0 && (
            <>
              <Label>משפחת המילה</Label>
              <p className="note">{word.family.join(' · ')}</p>
            </>
          )}
          <Label>דוגמאות</Label>
          <ul className="examples">
            {word.ex.map((e, i) => (
              <li key={i} className="with-audio">
                <span>
                  <Example text={e} />
                </span>
                <AudioButton small text={e.replace(/[[\]]/g, '')} label="השמעת המשפט" />
              </li>
            ))}
          </ul>
          {word.col.length > 0 && (
            <>
              <Label>צירופים נפוצים</Label>
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
              <Label>
                ההבדל מ־<span className="en">{word.syn.slice(0, 3).join(', ')}</span>
              </Label>
              <p className="note">{word.nuance}</p>
            </>
          )}
          {word.ety && (
            <>
              <Label>מקור המילה</Label>
              <p className="note">{word.ety}</p>
            </>
          )}
          {(root || word.themes.length > 0) && (
            <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
              {root && (
                <button className="chip" onClick={() => go('browse', 'root-' + root.key)}>
                  <span dir="rtl">
                    שורש{' '}
                    <bdi lang="en" dir="ltr">
                      {root.form}
                    </bdi>{' '}
                    · {root.he}
                  </span>
                </button>
              )}
              {word.themes.map((t) => (
                <button key={t} className="chip" onClick={() => go('browse', 'theme-' + t)}>
                  {themeByKey.get(t)?.he ?? t}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

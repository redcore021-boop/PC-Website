import type { WordEntry } from '../types';
import { allExamples, mainExample, rootByKey, shortHe, simpleDef, themeByKey } from '../lib/words';
import { go } from '../lib/router';
import { REGISTER_LABEL, TIER_LABEL } from '../strings';
import { AudioButton } from './AudioButton';

/** Render an example with its [target] highlighted. */
export function Example({ text }: { text: string }) {
  const parts = text.split(/\[([^\]]+)\]/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

const plainText = (s: string) => s.replace(/[[\]]/g, '');

/** The word, its part of speech and pronunciation — the first thing the eye lands on. */
export function WordHeader({ word, size }: { word: WordEntry; size?: 'sm' }) {
  return (
    <div className="wh">
      <div className="wh-top">
        <h2 className={'headword' + (size ? ' ' + size : '')} lang="en">
          {word.word}
        </h2>
        <AudioButton text={word.word} />
      </div>
      <div className="wh-meta">
        <span className="pos">{word.pos}</span>
        {word.ipa && <span className="ipa">/{word.ipa}/</span>}
      </div>
    </div>
  );
}

/** The short Hebrew meaning — understood at a glance. */
export function HebrewMeaning({ word }: { word: WordEntry }) {
  return (
    <p className="he-main" dir="rtl" lang="he">
      {shortHe(word)}
    </p>
  );
}

/**
 * A word, shown the way people learn it:
 * the word → its Hebrew meaning → Simple English → an everyday example.
 * Everything else (dictionary definition, more examples, phrases, nuance, origin)
 * waits under "more about this word".
 */
export function WordEntryView({ word, brief = false, open = false }: { word: WordEntry; brief?: boolean; open?: boolean }) {
  const example = mainExample(word);
  return (
    <div className="wcard" dir="ltr" lang="en">
      <WordHeader word={word} size={brief ? 'sm' : undefined} />
      <HebrewMeaning word={word} />

      <div className="wsec">
        <div className="wlabel">Simple English</div>
        <p className="simple">{simpleDef(word)}</p>
      </div>

      {example && (
        <div className="wsec">
          <div className="wlabel">Example</div>
          <div className="example-main">
            <p>
              <Example text={example} />
            </p>
            {!brief && <AudioButton small text={plainText(example)} label="השמעת המשפט" />}
          </div>
        </div>
      )}

      {!brief && <MoreAboutWord word={word} open={open} />}
    </div>
  );
}

function MoreAboutWord({ word, open }: { word: WordEntry; open: boolean }) {
  const root = word.root ? rootByKey.get(word.root) : undefined;
  const others = allExamples(word).filter((e) => e !== mainExample(word));
  // other Hebrew renderings, without repeating the one already shown
  const main = shortHe(word);
  const fullHe = word.he
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => x && x !== main && !main.includes(x.replace(/\(.*?\)/g, '').trim()))
    .join(', ');
  return (
    <details className="more" open={open}>
      <summary dir="rtl">עוד על המילה</summary>
      <div className="more-body">
        {fullHe && (
          <div className="wsec">
            <div className="wlabel" dir="rtl" style={{ textAlign: 'left' }}>
              תרגומים נוספים
            </div>
            <p className="note" dir="rtl" lang="he" style={{ textAlign: 'left' }}>
              {fullHe}
            </p>
          </div>
        )}
        {word.def !== simpleDef(word) && (
          <div className="wsec">
            <div className="wlabel">Dictionary definition</div>
            <p className="note">{word.def}</p>
          </div>
        )}
        {others.length > 0 && (
          <div className="wsec">
            <div className="wlabel">More examples</div>
            <ul className="examples">
              {others.map((e, i) => (
                <li key={i} className="with-audio">
                  <span>
                    <Example text={e} />
                  </span>
                  <AudioButton small text={plainText(e)} label="השמעת המשפט" />
                </li>
              ))}
            </ul>
          </div>
        )}
        {word.col.length > 0 && (
          <div className="wsec">
            <div className="wlabel">Common phrases</div>
            <div className="colls">
              {word.col.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {word.nuance && (
          <div className="wsec">
            <div className="wlabel">How it differs{word.syn.length ? ` from ${word.syn.slice(0, 3).join(', ')}` : ''}</div>
            <p className="note">{word.nuance}</p>
          </div>
        )}
        {word.family.length > 0 && (
          <div className="wsec">
            <div className="wlabel">Word family</div>
            <p className="note">{word.family.join(' · ')}</p>
          </div>
        )}
        {word.ety && (
          <div className="wsec">
            <div className="wlabel">Origin</div>
            <p className="note">{word.ety}</p>
          </div>
        )}
        <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
          <span className="chip accent">{REGISTER_LABEL[word.reg]}</span>
          <span className="chip">{TIER_LABEL[word.tier]}</span>
          {word.custom && <span className="chip good">הוספת בעצמך</span>}
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
      </div>
    </details>
  );
}

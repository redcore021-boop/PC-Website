import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { statusOf, STATUS_LABEL } from '../lib/status';
import { retrievability } from '../lib/srs';
import { back } from '../lib/router';
import { BackIcon } from '../components/Icons';
import { WordEntryView } from '../components/WordBits';
import { formatDate } from '../strings';
import { AccentButtons } from '../components/AudioButton';

export function WordPage({ id }: { id?: string }) {
  const { wordById, toast } = useApp();
  const word = id ? wordById.get(id) : undefined;
  const progress = useLiveQuery(() => (id ? db.progress.get(id) : undefined), [id]);
  const sentences = useLiveQuery(() => (id ? db.sentences.where('wordId').equals(id).reverse().sortBy('at') : []), [id], []);
  const [editing, setEditing] = useState(false);
  const [he, setHe] = useState('');

  if (!word) {
    return (
      <div className="empty">
        המילה לא נמצאה.{' '}
        <button className="btn small" onClick={() => back('browse')}>
          חזרה
        </button>
      </div>
    );
  }

  const status = statusOf(progress);
  const saveHe = async () => {
    await db.edits.put({ id: word.id, he: he.trim() });
    if (word.custom) await db.customWords.update(word.id, { he: he.trim() });
    setEditing(false);
    toast('התרגום נשמר');
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="חזרה" onClick={() => back('browse')}>
          <BackIcon className="flip" />
        </button>
        <span className="spacer" />
        <span className={'chip' + (status === 'mastered' ? ' good' : status === 'new' ? '' : ' accent')}>{STATUS_LABEL[status]}</span>
      </header>

      <section className="card">
        <WordEntryView word={word} />
        <div style={{ marginTop: 14 }}>
          <AccentButtons text={word.word} />
        </div>
      </section>

      {sentences.length > 0 && (
        <>
          <h3 className="section-title">המשפטים שכתבת</h3>
          <section className="card">
            <ul className="examples">
              {sentences.map((s) => (
                <li key={s.id} dir="ltr" lang="en">
                  {s.text} <span className="tiny faint">· {formatDate(s.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h3 className="section-title">ההתקדמות שלך</h3>
      <section className="card small">
        {progress ? (
          <div className="stack">
            <div className="row">
              <span className="muted spacer">החזרה הבאה</span>
              <span>{formatDate(progress.card.due)}</span>
            </div>
            <div className="row">
              <span className="muted spacer">סיכוי לזכור כרגע</span>
              <span>{Math.round(retrievability(progress.card) * 100)}%</span>
            </div>
            <div className="row">
              <span className="muted spacer">שימושים מוצלחים במילה</span>
              <span>{progress.production}</span>
            </div>
            <div className="row">
              <span className="muted spacer">טעויות</span>
              <span>{progress.mistakes}</span>
            </div>
            <button
              className="btn small block"
              onClick={async () => {
                await db.progress.update(word.id, { suspended: !progress.suspended });
                toast(progress.suspended ? 'המילה חזרה לחזרות' : 'המילה הושהתה — היא לא תופיע בחזרות');
              }}
            >
              {progress.suspended ? 'להחזיר את המילה לחזרות' : 'להשהות את המילה'}
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            עוד לא התחלת ללמוד אותה — היא תופיע בין המילים החדשות.
          </p>
        )}
      </section>

      <h3 className="section-title">התרגום לעברית</h3>
      <section className="card">
        {editing ? (
          <div className="stack">
            <input className="answer-input he" dir="rtl" lang="he" value={he} onChange={(e) => setHe(e.target.value)} aria-label="תרגום לעברית" />
            <div className="row">
              <button className="btn small" onClick={() => setEditing(false)}>
                ביטול
              </button>
              <button className="btn small primary" onClick={saveHe}>
                שמירה
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn small"
            onClick={() => {
              setHe(word.he);
              setEditing(true);
            }}
          >
            {word.he ? 'לערוך את התרגום' : 'להוסיף תרגום'}
          </button>
        )}
      </section>
    </>
  );
}

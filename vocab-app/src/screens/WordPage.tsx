import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state';
import { db } from '../lib/db';
import { statusOf, STATUS_LABEL } from '../lib/status';
import { retrievability } from '../lib/srs';
import { back } from '../lib/router';
import { BackIcon } from '../components/Icons';
import { WordEntryView } from '../components/WordBits';
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
        Word not found.{' '}
        <button className="btn small" onClick={() => back('browse')}>
          Back
        </button>
      </div>
    );
  }

  const status = statusOf(progress);
  const saveHe = async () => {
    await db.edits.put({ id: word.id, he: he.trim() });
    if (word.custom) await db.customWords.update(word.id, { he: he.trim() });
    setEditing(false);
    toast('Hebrew translation saved');
  };

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => back('browse')}>
          <BackIcon />
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
          <h3 className="section-title">Your sentences</h3>
          <section className="card">
            <ul className="examples">
              {sentences.map((s) => (
                <li key={s.id}>
                  {s.text} <span className="tiny faint">· {new Date(s.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h3 className="section-title">Your progress</h3>
      <section className="card small">
        {progress ? (
          <div className="stack">
            <div className="row">
              <span className="muted spacer">Next review</span>
              <span>{new Date(progress.card.due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="row">
              <span className="muted spacer">Recall probability now</span>
              <span>{Math.round(retrievability(progress.card) * 100)}%</span>
            </div>
            <div className="row">
              <span className="muted spacer">Successful production answers</span>
              <span>{progress.production}</span>
            </div>
            <div className="row">
              <span className="muted spacer">Mistakes</span>
              <span>{progress.mistakes}</span>
            </div>
            <button
              className="btn small block"
              onClick={async () => {
                await db.progress.update(word.id, { suspended: !progress.suspended });
                toast(progress.suspended ? 'Back in your reviews' : 'Paused — it won’t come up in reviews');
              }}
            >
              {progress.suspended ? 'Resume reviewing this word' : 'Pause this word'}
            </button>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Not started yet — it will appear among your new words.
          </p>
        )}
      </section>

      <h3 className="section-title">Hebrew hint</h3>
      <section className="card">
        {editing ? (
          <div className="stack">
            <input className="answer-input he" dir="rtl" lang="he" value={he} onChange={(e) => setHe(e.target.value)} aria-label="Hebrew translation" />
            <div className="row">
              <button className="btn small" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn small primary" onClick={saveHe}>
                Save
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
            {word.he ? 'Edit Hebrew translation' : 'Add Hebrew translation'}
          </button>
        )}
      </section>
    </>
  );
}

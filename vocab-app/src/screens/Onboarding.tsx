import { useState } from 'react';
import { useApp } from '../state';
import { db } from '../lib/db';
import { WARMUP_START } from '../lib/session';
import { StageLadder } from '../components/StageLadder';

const PACES = [
  { n: 5, label: 'Relaxed', sub: '5 new words a day · about 5–10 min' },
  { n: 10, label: 'Regular', sub: '10 new words a day · about 10–15 min' },
  { n: 15, label: 'Intensive', sub: '15 new words a day · about 20+ min' },
];

/** First-launch welcome: what the app does, how words climb from easy to hard, and the daily pace. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState(0);
  const [pace, setPace] = useState(settings.newPerDay);
  const [hebrew, setHebrew] = useState(settings.showHebrew);

  const finish = async () => {
    await updateSettings({ newPerDay: pace, showHebrew: hebrew });
    await db.kv.put({ key: 'onboarded', value: Date.now() });
    onDone();
  };

  return (
    <div className="app fullscreen onboarding">
      <div className="dots" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <section>
          <div className="brand" style={{ fontSize: 44, marginTop: 24 }}>
            Lexicon
          </div>
          <h1 className="ob-title">Advanced English you can actually use.</h1>
          <p className="ob-text">
            Most apps teach you to <em>recognise</em> words. Lexicon takes each word further — until you can use it in your own speech and
            writing.
          </p>
          <ul className="ob-list">
            <li>A few minutes a day, scheduled by memory science (FSRS)</li>
            <li>Real example sentences, collocations and nuance</li>
            <li>Hebrew hints whenever you want them</li>
            <li>Free, offline, and private — everything stays on your phone</li>
          </ul>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="ob-title" style={{ marginTop: 32 }}>
            Every word starts easy.
          </h1>
          <p className="ob-text">Words climb a ladder. They move up when you get them right and step back down if you slip — so it never gets too hard too fast.</p>
          <StageLadder />
          <p className="ob-text small">
            The first words are the most useful ones, and your first week warms up gently, starting with {WARMUP_START} new words a day.
          </p>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="ob-title" style={{ marginTop: 32 }}>
            Choose your pace
          </h1>
          <p className="ob-text">You can change this any time in Settings.</p>
          <div className="stack" role="radiogroup" aria-label="Daily pace">
            {PACES.map((p) => (
              <button key={p.n} role="radio" aria-checked={pace === p.n} className={'pace' + (pace === p.n ? ' on' : '')} onClick={() => setPace(p.n)}>
                <strong>
                  {p.label}
                  {p.n === 10 && <span className="chip accent" style={{ marginLeft: 8 }}>recommended</span>}
                </strong>
                <span>{p.sub}</span>
              </button>
            ))}
          </div>
          <label className="pace" style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ color: 'var(--ink)', fontSize: 16 }}>Show Hebrew automatically</strong>
              <span>Off: tap “עברית” to reveal it when you need it</span>
            </span>
            <span className="switch">
              <input type="checkbox" role="switch" checked={hebrew} onChange={(e) => setHebrew(e.target.checked)} aria-label="Show Hebrew automatically" />
              <span />
            </span>
          </label>
        </section>
      )}

      <div className="bottom-actions" style={{ gridTemplateColumns: step ? '1fr 2fr' : '1fr' }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < 2 ? (
          <button className="btn primary" onClick={() => setStep(step + 1)}>
            {step === 0 ? 'Get started' : 'Next'}
          </button>
        ) : (
          <button className="btn primary" onClick={finish}>
            Start learning
          </button>
        )}
      </div>
    </div>
  );
}

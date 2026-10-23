import { useState } from 'react';
import { useApp } from '../state';
import { db } from '../lib/db';
import { WARMUP_START } from '../lib/session';
import { StageLadder } from '../components/StageLadder';

const PACES = [
  { n: 5, label: 'רגוע', sub: '5 מילים חדשות ביום · בערך 5–10 דקות' },
  { n: 10, label: 'רגיל', sub: '10 מילים חדשות ביום · בערך 10–15 דקות' },
  { n: 15, label: 'אינטנסיבי', sub: '15 מילים חדשות ביום · 20 דקות ומעלה' },
];

/** First-launch welcome: what the app does, how words climb from easy to hard, and the daily pace. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { settings, updateSettings } = useApp();
  const [step, setStep] = useState(0);
  const [pace, setPace] = useState(settings.newPerDay);

  const finish = async () => {
    await updateSettings({ newPerDay: pace });
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
          <h1 className="ob-title">אנגלית מתקדמת שאפשר באמת להשתמש בה.</h1>
          <p className="ob-text">
            רוב האפליקציות מלמדות <em>לזהות</em> מילים. Lexicon לוקחת כל מילה הלאה — עד שתוכלו להשתמש בה בעצמכם, בדיבור ובכתיבה.
          </p>
          <ul className="ob-list">
            <li>כמה דקות ביום, בתזמון שמבוסס על חקר הזיכרון (FSRS)</li>
            <li>משפטים אמיתיים, צירופים נפוצים והבדלי משמעות דקים</li>
            <li>כל מילה עם תרגום לעברית והסבר באנגלית פשוטה</li>
            <li>חינם, עובד בלי אינטרנט, והכול נשאר בטלפון שלכם</li>
          </ul>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="ob-title" style={{ marginTop: 32 }}>
            כל מילה מתחילה בקטן.
          </h1>
          <p className="ob-text">המילים מטפסות בסולם: עולות שלב כשעונים נכון, ויורדות שלב אחד כשטועים — כך שזה אף פעם לא נהיה קשה מדי מהר מדי.</p>
          <StageLadder />
          <p className="ob-text small">
            המילים הראשונות הן הקלות והשימושיות ביותר, והשבוע הראשון מתחיל בעדינות — {WARMUP_START} מילים חדשות ביום.
          </p>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="ob-title" style={{ marginTop: 32 }}>
            באיזה קצב נלמד?
          </h1>
          <p className="ob-text">אפשר לשנות את זה בכל רגע בהגדרות.</p>
          <div className="stack" role="radiogroup" aria-label="קצב יומי">
            {PACES.map((p) => (
              <button key={p.n} role="radio" aria-checked={pace === p.n} className={'pace' + (pace === p.n ? ' on' : '')} onClick={() => setPace(p.n)}>
                <strong>
                  {p.label}
                  {p.n === 10 && <span className="chip accent" style={{ marginInlineStart: 8 }}>מומלץ</span>}
                </strong>
                <span>{p.sub}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="bottom-actions" style={{ gridTemplateColumns: step ? '1fr 2fr' : '1fr' }}>
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            חזרה
          </button>
        )}
        {step < 2 ? (
          <button className="btn primary" onClick={() => setStep(step + 1)}>
            {step === 0 ? 'בואו נתחיל' : 'הבא'}
          </button>
        ) : (
          <button className="btn primary" onClick={finish}>
            להתחיל ללמוד
          </button>
        )}
      </div>
    </div>
  );
}

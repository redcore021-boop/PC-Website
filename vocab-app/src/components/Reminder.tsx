import { useApp } from '../state';
import { db } from '../lib/db';
import { downloadIcs, googleCalendarUrl, isIOS } from '../lib/reminder';

const markSet = () => db.kv.put({ key: 'reminderSet', value: Date.now() });

/** Pick a time, then add a repeating daily event to the phone's calendar. */
export function ReminderSetup() {
  const { settings, updateSettings, toast } = useApp();
  const time = settings.reminderTime;
  const ios = isIOS();

  const google = (
    <a
      className={'btn block' + (ios ? '' : ' primary')}
      href={googleCalendarUrl(time)}
      target="_blank"
      rel="noopener"
      onClick={() => void markSet()}
    >
      להוסיף ליומן גוגל
    </a>
  );
  const file = (
    <button
      className={'btn block' + (ios ? ' primary' : '')}
      onClick={() => {
        downloadIcs(time);
        void markSet();
        toast('פתחו את הקובץ כדי להוסיף את התזכורת ליומן');
      }}
    >
      {ios ? 'להוסיף ליומן של האייפון' : 'קובץ ליומן אחר (‎.ics)'}
    </button>
  );

  return (
    <div className="reminder">
      <label className="setting" style={{ minHeight: 0, padding: '4px 0 12px' }}>
        <span className="label">באיזו שעה להזכיר?</span>
        <input
          type="time"
          className="time-input"
          dir="ltr"
          value={time}
          onChange={(e) => e.target.value && void updateSettings({ reminderTime: e.target.value })}
        />
      </label>
      <div className="stack">
        {ios ? file : google}
        {ios ? google : file}
      </div>
      <p className="tiny faint" style={{ marginBottom: 0 }}>
        נוצר אירוע חוזר כל יום ב־<bdi dir="ltr">{time}</bdi> עם התראה וקישור לאפליקציה. אפשר לשנות או למחוק אותו ביומן בכל רגע.
      </p>
    </div>
  );
}

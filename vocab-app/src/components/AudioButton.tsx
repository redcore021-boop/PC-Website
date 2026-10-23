import { ENABLED_FEATURES } from '../features';
import { speak, speechSupported } from '../lib/speech';
import { useApp } from '../state';
import { SpeakerIcon } from './Icons';

export function AudioButton({ text, label = 'השמעת ההגייה', lang, small }: { text: string; label?: string; lang?: 'en-US' | 'en-GB'; small?: boolean }) {
  const { settings } = useApp();
  if (!ENABLED_FEATURES.audio || !speechSupported()) return null;
  return (
    <button
      type="button"
      className={'icon-btn' + (small ? ' sm' : '')}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang ?? settings.accent);
      }}
    >
      <SpeakerIcon />
    </button>
  );
}

/** US and UK pronunciation side by side. */
export function AccentButtons({ text }: { text: string }) {
  if (!ENABLED_FEATURES.audio || !speechSupported()) return null;
  return (
    <div className="row" style={{ gap: 6 }} dir="ltr">
      {(['en-US', 'en-GB'] as const).map((l) => (
        <button key={l} type="button" className="btn small" onClick={() => speak(text, l)} aria-label={l === 'en-US' ? 'הגייה אמריקאית' : 'הגייה בריטית'}>
          <SpeakerIcon width={16} height={16} /> {l === 'en-US' ? 'אמריקאית' : 'בריטית'}
        </button>
      ))}
    </div>
  );
}

import { ENABLED_FEATURES } from '../features';
import { speak, speechSupported } from '../lib/speech';
import { useApp } from '../state';
import { SpeakerIcon } from './Icons';

export function AudioButton({ text, label = 'Play pronunciation' }: { text: string; label?: string }) {
  const { settings } = useApp();
  if (!ENABLED_FEATURES.audio || !speechSupported()) return null;
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={() => speak(text, settings.accent)}>
      <SpeakerIcon />
    </button>
  );
}

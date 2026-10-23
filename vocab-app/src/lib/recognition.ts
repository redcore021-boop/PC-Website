import { levenshtein, normalize } from './fuzzy';
import { alternativeSpellings } from './spelling';

/**
 * Pronunciation check with the browser's built-in speech recognition (free, no API key).
 * Chrome on Android and Safari on iPhone support it; it needs an internet connection.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionEvent {
  results: ArrayLike<ArrayLike<RecognitionAlternative>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!ctor();
}

export type RecognitionError = 'not-allowed' | 'no-speech' | 'network' | 'other';

export const RECOGNITION_ERROR_TEXT: Record<RecognitionError, string> = {
  'not-allowed': 'אין גישה למיקרופון. צריך לאשר גישה למיקרופון בהגדרות הדפדפן.',
  'no-speech': 'לא שמעתי כלום. נסו שוב, קרוב יותר לטלפון.',
  network: 'זיהוי הדיבור צריך חיבור לאינטרנט.',
  other: 'זיהוי הדיבור לא הצליח הפעם. נסו שוב.',
};

export interface Listening {
  /** What was heard: every alternative the recognizer offered, best guess first */
  result: Promise<string[]>;
  stop: () => void;
}

/** Listen for one short utterance. Rejects with a RecognitionError. */
export function listenOnce(lang: 'en-US' | 'en-GB' = 'en-US'): Listening {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.reject('other' as RecognitionError), stop: () => {} };
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 5;
  let heard: string[] | null = null;
  const result = new Promise<string[]>((resolve, reject) => {
    rec.onresult = (e) => {
      const first = e.results[0];
      heard = first ? Array.from(first, (a) => a.transcript) : [];
    };
    rec.onerror = (e) => {
      const err: RecognitionError =
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'not-allowed'
          : e.error === 'no-speech' || e.error === 'aborted'
            ? 'no-speech'
            : e.error === 'network'
              ? 'network'
              : 'other';
      reject(err);
    };
    rec.onend = () => (heard && heard.length ? resolve(heard) : reject('no-speech' as RecognitionError));
  });
  try {
    rec.start();
  } catch {
    return { result: Promise.reject('other' as RecognitionError), stop: () => {} };
  }
  return { result, stop: () => rec.stop() };
}

/**
 * Did the learner say the word? The recognizer only writes real words, so a different
 * word means a different sound: we need the word itself (or a spelling variant) in one of
 * its guesses. A near miss is allowed only for long words, where recognizers often
 * slip a letter. "I said mitigate" still counts.
 */
export function heardCorrectly(heard: string[], target: string): boolean {
  const forms = [target, ...alternativeSpellings(target)].map(normalize);
  const size = forms[0].split(' ').length;
  const close = (s: string) => forms.some((f) => s === f || (f.length >= 9 && levenshtein(s, f) <= 1));
  for (const h of heard) {
    const words = normalize(h).split(' ').filter(Boolean);
    for (let i = 0; i + size <= words.length; i++) {
      if (close(words.slice(i, i + size).join(' '))) return true;
    }
    if (close(normalize(h))) return true;
  }
  return false;
}

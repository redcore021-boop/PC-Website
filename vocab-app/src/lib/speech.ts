/** Free text-to-speech through the browser's Web Speech API. */

let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  voices = speechSynthesis.getVoices();
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function speechSupported(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

// Higher-quality voices on iOS / macOS / Android / Chrome, in order of preference.
const PREFERRED: Record<string, string[]> = {
  'en-US': ['Samantha', 'Ava', 'Allison', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex'],
  'en-GB': ['Daniel', 'Serena', 'Kate', 'Google UK English Female', 'Google UK English Male', 'Microsoft Sonia', 'Microsoft Libby'],
};

export function pickVoice(lang: 'en-US' | 'en-GB'): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  const matching = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
  for (const name of PREFERRED[lang]) {
    const v = matching.find((m) => m.name.includes(name));
    if (v) return v;
  }
  return matching.find((v) => v.localService) ?? matching[0];
}

export function hasVoice(lang: 'en-US' | 'en-GB'): boolean {
  return !!pickVoice(lang);
}

export function speak(text: string, lang: 'en-US' | 'en-GB' = 'en-US', rate = 0.92) {
  if (!speechSupported()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = rate;
  speechSynthesis.speak(u);
}

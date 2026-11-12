// Text-to-speech through the Web Speech API (works in Chrome/Edge/Electron).
// TODO(android): the Android WebView has no speechSynthesis; add a Capacitor TTS plugin.

const LOCALES: Record<string, string> = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, lang: string, rate = 0.9): void {
  if (!canSpeak() || !text.trim()) return;
  const locale = LOCALES[lang] ?? lang;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

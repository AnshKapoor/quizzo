import type { ReactNode } from 'react';
import { canSpeak, speak } from '../lib/speech';

export function SpeakButton({ text, lang }: { text: string; lang: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className="icon-btn"
      title="Listen"
      aria-label="Listen"
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang);
      }}
    >
      🔊
    </button>
  );
}

const GERMAN_CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

/** Buttons for characters that are awkward to type on non-German keyboards. */
export function SpecialCharBar({ onInsert, lang }: { onInsert: (ch: string) => void; lang: string }) {
  if (lang !== 'de') return null;
  return (
    <div className="charbar" aria-label="Special characters">
      {GERMAN_CHARS.map((ch) => (
        <button
          key={ch}
          type="button"
          className="char-btn"
          // keep focus in the text field
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}

export function Feedback({ correct, children }: { correct: boolean; children?: ReactNode }) {
  return (
    <div className={`feedback ${correct ? 'ok' : 'bad'}`} role="status">
      <strong>{correct ? '✓ Richtig!' : '✗ Not quite'}</strong>
      {children}
    </div>
  );
}

export function Explanation({ text }: { text?: string }) {
  return text ? <p className="explanation">💡 {text}</p> : null;
}

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

/**
 * Where a card's Check button and its result go. While studying this is the bar fixed to the
 * bottom of the screen, so the card itself never changes size or moves when an answer is checked.
 * Without it (editor preview, help examples) they stay inside the card.
 */
export const ActionSlotContext = createContext<HTMLElement | null>(null);

/** Puts its children in the action bar when there is one, otherwise leaves them in place. */
export function CardAction({ children }: { children: ReactNode }) {
  const slot = useContext(ActionSlotContext);
  return slot ? createPortal(children, slot) : <>{children}</>;
}

export function CheckButton({
  disabled,
  onClick,
  children = 'Check',
}: {
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <CardAction>
      <button type="button" className="primary check-btn" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    </CardAction>
  );
}

export function Feedback({ correct, children }: { correct: boolean; children?: ReactNode }) {
  return (
    <CardAction>
      <div className={`feedback ${correct ? 'ok' : 'bad'}`} role="status">
        <strong>{correct ? '✓ Richtig!' : '✗ Not quite'}</strong>
        {children}
      </div>
    </CardAction>
  );
}

export function Explanation({ text }: { text?: string }) {
  return text ? (
    <CardAction>
      <p className="explanation">💡 {text}</p>
    </CardAction>
  ) : null;
}

/**
 * A labelled form field. Its help text stays hidden behind a small "?" next to the label,
 * so a form shows only the inputs until someone asks for the explanation.
 */
export function Field({
  label,
  help,
  className = '',
  children,
}: {
  label: string;
  help?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`field ${className}`}>
      <span className="field-label">
        {label}
        {help && (
          <button
            type="button"
            className="icon-btn help-link tip-btn"
            aria-expanded={open}
            aria-label={`About: ${label}`}
            title="What is this?"
            onClick={() => setOpen((o) => !o)}
          >
            ?
          </button>
        )}
      </span>
      {children}
      {help && open && <small className="field-help">{help}</small>}
    </div>
  );
}

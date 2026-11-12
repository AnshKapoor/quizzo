import { useEffect, useRef, useState } from 'react';
import type { DictationCard } from '../../types';
import { compareWords, dictationCorrect, type WordResult } from '../../lib/diff';
import { canSpeak, speak } from '../../lib/speech';
import { Explanation, Feedback, SpecialCharBar } from '../common';
import type { CardViewProps } from './CardView';

/** Listen and type what you hear. */
export function DictationView({ card, lang, onAnswer, autoPlay }: CardViewProps<DictationCard>) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<WordResult[] | null>(null);
  const [showText, setShowText] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const audio = canSpeak();

  useEffect(() => {
    if (autoPlay && audio) speak(card.text, lang);
  }, [autoPlay, audio, card, lang]);

  const check = () => {
    if (result || !value.trim()) return;
    setResult(compareWords(card.text, value, card.caseSensitive));
    const ok = dictationCorrect(card.text, value, card.caseSensitive);
    onAnswer({ correct: ok, grade: ok ? 'good' : 'again' });
  };

  const insert = (ch: string) => {
    const el = input.current;
    if (!el || result) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };

  const ok = result ? dictationCorrect(card.text, value, card.caseSensitive) : false;

  return (
    <div className="card-body">
      <div className="prompt">Write what you hear</div>
      {audio ? (
        <div className="row">
          <button type="button" className="play" onClick={() => speak(card.text, lang)}>
            ▶ Play
          </button>
          <button type="button" onClick={() => speak(card.text, lang, 0.6)}>
            🐢 Slowly
          </button>
        </div>
      ) : (
        <div className="notice">
          Audio isn't available on this device yet.{' '}
          {showText ? (
            <strong>{card.text}</strong>
          ) : (
            <button type="button" className="ghost" onClick={() => setShowText(true)}>
              Show the sentence instead
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <input
          ref={input}
          className="dictation-input"
          value={value}
          readOnly={!!result}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type the sentence…"
          onChange={(e) => setValue(e.target.value)}
        />
      </form>
      {!result && (
        <>
          <SpecialCharBar lang={lang} onInsert={insert} />
          <button type="button" className="primary" disabled={!value.trim()} onClick={check}>
            Check
          </button>
        </>
      )}
      {result && (
        <Feedback correct={ok}>
          {result.some((w) => w.status === 'umlaut') && <span> Accepted, but try writing ä, ö, ü and ß.</span>}
        </Feedback>
      )}
      {result && (
        <div className="dictation-result">
          {result.map((w, i) => (
            <span key={i} className={`w-${w.status}`}>
              {w.word}
            </span>
          ))}
        </div>
      )}
      {result && card.translation && <div className="sub translation">{card.translation}</div>}
      {result && <Explanation text={card.explanation} />}
    </div>
  );
}

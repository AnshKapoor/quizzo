import { useMemo, useState } from 'react';
import type { SpotCard } from '../../types';
import { correctedSentence, parseSpot } from '../../lib/spot';
import { Explanation, Feedback, SpeakButton } from '../common';
import type { CardViewProps } from './CardView';

/** Find the mistake: tap the wrong word(s). */
export function SpotView({ card, lang, onAnswer }: CardViewProps<SpotCard>) {
  const tokens = useMemo(() => parseSpot(card.text), [card]);
  const errors = tokens.flatMap((t, i) => (t.correction !== undefined ? [i] : []));
  const [sel, setSel] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const isCorrect = sel.length === errors.length && sel.every((i) => errors.includes(i));
  const fixed = correctedSentence(tokens);

  const check = () => {
    setChecked(true);
    onAnswer({ correct: isCorrect, grade: isCorrect ? 'good' : 'again' });
  };

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Find the mistake'}</div>
      <div className="sub">
        Tap the wrong word{errors.length > 1 ? `s (${errors.length} mistakes)` : ''}.
        {card.translation && <> Meaning: <em>{card.translation}</em></>}
      </div>
      <div className="spot-line">
        {tokens.map((t, i) => {
          const isErr = t.correction !== undefined;
          const picked = sel.includes(i);
          const state = !checked
            ? picked
              ? 'selected'
              : ''
            : isErr
              ? picked
                ? 'found'
                : 'missed'
              : picked
                ? 'wrong'
                : '';
          return (
            <span key={i} className="spot-wrap">
              <button
                type="button"
                className={`word ${state}`}
                disabled={checked}
                onClick={() => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
              >
                {t.text}
              </button>
              {checked && isErr && <span className="solution">{t.correction || '(delete)'}</span>}
            </span>
          );
        })}
      </div>
      {!checked && (
        <button type="button" className="primary" disabled={!sel.length} onClick={check}>
          Check
        </button>
      )}
      {checked && <Feedback correct={isCorrect} />}
      {checked && (
        <div className="example">
          {fixed} <SpeakButton text={fixed} lang={lang} />
        </div>
      )}
      {checked && <Explanation text={card.explanation} />}
    </div>
  );
}

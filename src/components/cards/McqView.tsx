import { useMemo, useState } from 'react';
import type { McqCard } from '../../types';
import { shuffleIndexes } from '../../lib/util';
import { Explanation, Feedback, SpeakButton } from '../common';
import type { CardViewProps } from './CardView';

export function McqView({ card, lang, onAnswer }: CardViewProps<McqCard>) {
  const order = useMemo(
    () => (card.shuffle === false ? card.options.map((_, i) => i) : shuffleIndexes(card.options.length)),
    [card],
  );
  const multi = card.answer.length > 1;
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  const isCorrect = (sel: number[]) =>
    sel.length === card.answer.length && sel.every((i) => card.answer.includes(i));

  const submit = (sel: number[]) => {
    setChecked(true);
    const correct = isCorrect(sel);
    onAnswer({ correct, grade: correct ? 'good' : 'again' });
  };

  const choose = (i: number) => {
    if (checked) return;
    if (multi) setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else {
      setSelected([i]);
      submit([i]);
    }
  };

  return (
    <div className="card-body">
      <div className="prompt">
        {card.prompt} <SpeakButton text={card.prompt.replace(/_+/g, ' ')} lang={lang} />
      </div>
      {multi && <div className="sub">Select all that apply</div>}
      <div className="options">
        {order.map((i) => {
          const isSel = selected.includes(i);
          const isAns = card.answer.includes(i);
          const state = checked ? (isAns ? 'correct' : isSel ? 'wrong' : 'dim') : isSel ? 'selected' : '';
          return (
            <button key={i} type="button" className={`option ${state}`} onClick={() => choose(i)} disabled={checked}>
              {multi && <span className="checkbox">{isSel ? '☑' : '☐'}</span>}
              {card.options[i]}
            </button>
          );
        })}
      </div>
      {multi && !checked && (
        <button type="button" className="primary" disabled={!selected.length} onClick={() => submit(selected)}>
          Check
        </button>
      )}
      {checked && <Feedback correct={isCorrect(selected)} />}
      {checked && <Explanation text={card.explanation} />}
    </div>
  );
}

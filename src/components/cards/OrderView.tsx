import { useMemo, useState } from 'react';
import type { OrderCard } from '../../types';
import { sameSentence } from '../../lib/answer';
import { shuffleIndexes } from '../../lib/util';
import { Explanation, Feedback, SpeakButton } from '../common';
import type { CardViewProps } from './CardView';

export function OrderView({ card, lang, onAnswer }: CardViewProps<OrderCard>) {
  const pool = useMemo(() => shuffleIndexes(card.tokens.length), [card]);
  const [built, setBuilt] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const solution = card.tokens.join(' ');
  /** The correctly written sentence to show after checking (the matched one, if the attempt was right). */
  const [shown, setShown] = useState(solution);

  const check = () => {
    const attempt = built.map((i) => card.tokens[i]).join(' ');
    const match = [solution, ...(card.accept ?? [])].find((s) => sameSentence(s, attempt));
    setResult(!!match);
    if (match) setShown(match);
    onAnswer({ correct: !!match, grade: match ? 'good' : 'again' });
  };

  const locked = result !== null;

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Put the words in order'}</div>
      {card.translation && <div className="sub translation">{card.translation}</div>}
      <div className={`order-line ${locked ? (result ? 'correct' : 'wrong') : ''}`}>
        {built.length === 0 && <span className="placeholder">Tap the words below…</span>}
        {built.map((i, k) => (
          <button
            key={i}
            type="button"
            className="token"
            disabled={locked}
            onClick={() => setBuilt((b) => b.filter((_, j) => j !== k))}
          >
            {card.tokens[i]}
          </button>
        ))}
      </div>
      <div className="order-pool">
        {pool.map((i) => (
          <button
            key={i}
            type="button"
            className={`token ${built.includes(i) ? 'used' : ''}`}
            disabled={locked || built.includes(i)}
            onClick={() => setBuilt((b) => [...b, i])}
          >
            {card.tokens[i]}
          </button>
        ))}
      </div>
      {!locked && (
        <button type="button" className="primary" disabled={built.length !== card.tokens.length} onClick={check}>
          Check
        </button>
      )}
      {locked && (
        <Feedback correct={!!result}>
          {!result && <span> Correct: {solution}</span>}
        </Feedback>
      )}
      {locked && (
        <div className="example">
          {shown} <SpeakButton text={shown} lang={lang} />
        </div>
      )}
      {locked && <Explanation text={card.explanation} />}
    </div>
  );
}

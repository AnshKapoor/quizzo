import { useMemo, useState } from 'react';
import type { OrderCard } from '../../types';
import { sameSentence } from '../../lib/answer';
import { shuffleIndexes } from '../../lib/util';
import { Explanation, Feedback, SpeakButton } from '../common';
import { useDragDrop } from '../useDragDrop';
import { useFlip } from '../useFlip';
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
  // Words glide between the pool and the sentence.
  const flip = useFlip<HTMLDivElement>([built, locked]);

  // Drag a word into the sentence (onto a word = insert before it), within it, or back to the pool.
  const startDrag = useDragDrop<number>((tok, zone) => {
    if (locked) return;
    flip.skipNext(tok); // already where it was dropped
    setBuilt((b) => {
      const rest = b.filter((i) => i !== tok);
      if (zone === 'pool') return rest;
      if (zone === 'line') return [...rest, tok];
      const target = b[Number(zone.slice(2))];
      if (target === undefined || target === tok) return b;
      rest.splice(rest.indexOf(target), 0, tok);
      return rest;
    });
  });

  return (
    <div className="card-body" ref={flip.ref}>
      <div className="prompt">{card.prompt || 'Put the words in order'}</div>
      {card.translation && <div className="sub translation">{card.translation}</div>}
      <div data-drop="line" className={`order-line dropzone ${locked ? (result ? 'correct' : 'wrong') : ''}`}>
        {built.length === 0 && <span className="placeholder">Tap or drag the words below…</span>}
        {built.map((i, k) => (
          <button
            key={i}
            type="button"
            data-flip={i}
            data-drop={`w:${k}`}
            className="token draggable"
            disabled={locked}
            onPointerDown={(e) => startDrag(e, i)}
            onClick={() => setBuilt((b) => b.filter((_, j) => j !== k))}
          >
            {card.tokens[i]}
          </button>
        ))}
      </div>
      {/* Hidden once checked: every word is in the sentence, and the empty pool would leave a gap. */}
      {!locked && (
      <div data-drop="pool" className="order-pool">
        {pool.map((i) => (
          <button
            key={i}
            type="button"
            data-flip={i}
            className={`token draggable ${built.includes(i) ? 'used' : ''}`}
            disabled={locked || built.includes(i)}
            onPointerDown={(e) => startDrag(e, i)}
            onClick={() => setBuilt((b) => [...b, i])}
          >
            {card.tokens[i]}
          </button>
        ))}
      </div>
      )}
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

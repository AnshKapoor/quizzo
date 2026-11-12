import { useMemo, useState } from 'react';
import type { MatchCard } from '../../types';
import { shuffleIndexes } from '../../lib/util';
import { Explanation, Feedback } from '../common';
import { useDragDrop } from '../useDragDrop';
import type { CardViewProps } from './CardView';

type Side = 'left' | 'right';

export function MatchView({ card, onAnswer }: CardViewProps<MatchCard>) {
  const leftOrder = useMemo(() => shuffleIndexes(card.pairs.length), [card]);
  const rightOrder = useMemo(() => shuffleIndexes(card.pairs.length), [card]);
  const [pick, setPick] = useState<{ side: Side; i: number } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = matched.length === card.pairs.length;

  const click = (side: Side, i: number) => {
    if (done || matched.includes(i)) return;
    setWrong(null);
    if (!pick || pick.side === side) {
      setPick({ side, i });
      return;
    }
    pair(side === 'left' ? i : pick.i, side === 'right' ? i : pick.i);
  };

  // Dragging a tile onto a tile of the other column pairs them.
  const startDrag = useDragDrop<{ side: Side; i: number }>((from, zone) => {
    const [side, idx] = zone.split(':');
    const i = Number(idx);
    if (side === from.side || done || matched.includes(i) || matched.includes(from.i)) return;
    setWrong(null);
    pair(from.side === 'left' ? from.i : i, from.side === 'right' ? from.i : i);
  });

  const pair = (left: number, right: number) => {
    setPick(null);
    if (left === right) {
      const next = [...matched, left];
      setMatched(next);
      if (next.length === card.pairs.length) {
        onAnswer({ correct: mistakes === 0, grade: mistakes === 0 ? 'good' : 'again' });
      }
    } else {
      setMistakes((m) => m + 1);
      setWrong({ left, right });
    }
  };

  const cls = (side: Side, i: number) => {
    if (matched.includes(i)) return 'tile matched';
    if (wrong && wrong[side] === i) return 'tile wrong';
    if (pick?.side === side && pick.i === i) return 'tile selected';
    return 'tile';
  };

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Match the pairs'}</div>
      <div className="match-grid">
        <div className="match-col">
          {leftOrder.map((i) => (
            <button
              key={i}
              type="button"
              data-drop={`left:${i}`}
              className={`${cls('left', i)} draggable`}
              onPointerDown={(e) => !matched.includes(i) && startDrag(e, { side: 'left', i })}
              onClick={() => click('left', i)}
            >
              {card.pairs[i].left}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map((i) => (
            <button
              key={i}
              type="button"
              data-drop={`right:${i}`}
              className={`${cls('right', i)} draggable`}
              onPointerDown={(e) => !matched.includes(i) && startDrag(e, { side: 'right', i })}
              onClick={() => click('right', i)}
            >
              {card.pairs[i].right}
            </button>
          ))}
        </div>
      </div>
      {!done && mistakes > 0 && <div className="sub">Mistakes: {mistakes}</div>}
      {done && (
        <Feedback correct={mistakes === 0}>
          {mistakes > 0 && <span> {mistakes} wrong attempt{mistakes > 1 ? 's' : ''}.</span>}
        </Feedback>
      )}
      {done && <Explanation text={card.explanation} />}
    </div>
  );
}

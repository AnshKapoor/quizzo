import { useMemo, useState } from 'react';
import type { SequenceCard } from '../../types';
import { moveItem, shuffleIndexes } from '../../lib/util';
import { Explanation, Feedback } from '../common';
import { useDragDrop } from '../useDragDrop';
import type { CardViewProps } from './CardView';

/** Drag the lines into the right order. Tap one line and then another to swap them, or use the arrows. */
export function SequenceView({ card, onAnswer }: CardViewProps<SequenceCard>) {
  const start = useMemo(() => shuffleIndexes(card.items.length), [card]);
  /** order[pos] = index into card.items shown at that position. */
  const [order, setOrder] = useState<number[]>(start);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  // Compare text, so two identical lines are interchangeable.
  const rightAt = (pos: number) => card.items[order[pos]] === card.items[pos];
  const correct = checked && order.every((_, pos) => rightAt(pos));

  const move = (from: number, to: number) => {
    if (checked || from === to) return;
    setOrder((o) => moveItem(o, from, to));
    setSelected(null);
  };
  const startDrag = useDragDrop<number>((from, zone) => move(from, Number(zone.slice(2))));

  const tap = (pos: number) => {
    if (checked) return;
    if (selected === null) return setSelected(pos);
    if (selected !== pos) {
      setOrder((o) => {
        const a = o.slice();
        [a[selected], a[pos]] = [a[pos], a[selected]];
        return a;
      });
    }
    setSelected(null);
  };

  const check = () => {
    setChecked(true);
    const ok = order.every((_, pos) => rightAt(pos));
    onAnswer({ correct: ok, grade: ok ? 'good' : 'again' });
  };

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Put these in the right order'}</div>
      {!checked && <div className="sub">Drag the lines into order, or tap two lines to swap them.</div>}
      <ol className="sequence">
        {order.map((item, pos) => (
          <li key={item} data-drop={`s:${pos}`} className="dropzone">
            <span className="seq-num">{pos + 1}</span>
            <button
              type="button"
              className={`seq-item draggable ${selected === pos ? 'selected' : ''} ${
                checked ? (rightAt(pos) ? 'matched' : 'wrong-static') : ''
              }`}
              disabled={checked}
              onPointerDown={(e) => startDrag(e, pos)}
              onClick={() => tap(pos)}
            >
              {card.items[item]}
            </button>
            {!checked && (
              <span className="seq-arrows">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move up"
                  disabled={pos === 0}
                  onClick={() => move(pos, pos - 1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={pos === order.length - 1}
                  onClick={() => move(pos, pos + 1)}
                >
                  ▼
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!checked && (
        <button type="button" className="primary" onClick={check}>
          Check
        </button>
      )}
      {checked && <Feedback correct={correct} />}
      {checked && !correct && (
        <ol className="sequence-solution">
          {card.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
      {checked && <Explanation text={card.explanation} />}
    </div>
  );
}

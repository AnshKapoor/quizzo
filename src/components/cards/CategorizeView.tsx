import { useMemo, useState } from 'react';
import type { CategorizeCard } from '../../types';
import { shuffle } from '../../lib/util';
import { Explanation, Feedback } from '../common';
import { useDragDrop } from '../useDragDrop';
import type { CardViewProps } from './CardView';

export function CategorizeView({ card, onAnswer }: CardViewProps<CategorizeCard>) {
  const items = useMemo(
    () => shuffle(card.groups.flatMap((g, group) => g.items.map((text) => ({ text, group })))),
    [card],
  );
  /** Group index each item was put in, or null while still in the pool. */
  const [place, setPlace] = useState<(number | null)[]>(() => items.map(() => null));
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const put = (item: number, group: number | null) => {
    if (checked) return;
    setPlace((p) => p.map((g, i) => (i === item ? group : g)));
    setSelected(null);
  };
  const startDrag = useDragDrop<number>((item, zone) => put(item, zone === 'pool' ? null : Number(zone.slice(2))));
  const tapZone = (group: number | null) => {
    if (selected !== null) put(selected, group);
  };

  const allPlaced = place.every((g) => g !== null);
  const isRight = (i: number) => place[i] === items[i].group;
  const correct = checked && items.every((_, i) => isRight(i));

  const check = () => {
    setChecked(true);
    const ok = items.every((_, i) => isRight(i));
    onAnswer({ correct: ok, grade: ok ? 'good' : 'again' });
  };

  const tile = (i: number) => (
    <button
      key={i}
      type="button"
      className={`tile draggable ${selected === i ? 'selected' : ''} ${checked ? (isRight(i) ? 'matched' : 'wrong-static') : ''}`}
      disabled={checked}
      onPointerDown={(e) => startDrag(e, i)}
      onClick={(e) => {
        e.stopPropagation();
        setSelected((s) => (s === i ? null : i));
      }}
    >
      {items[i].text}
      {checked && !isRight(i) && <small className="should-be"> → {card.groups[items[i].group].name}</small>}
    </button>
  );

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Sort into groups'}</div>
      {!checked && <div className="sub">Drag each word into its group, or tap a word and then a group.</div>}
      {!checked && (
        <div data-drop="pool" className="pool dropzone" onClick={() => tapZone(null)}>
          {items.map((_, i) => place[i] === null && tile(i))}
          {allPlaced && <span className="placeholder">All sorted. Check your answer, or move words around.</span>}
        </div>
      )}
      <div className="groups">
        {card.groups.map((g, gi) => (
          <div
            key={gi}
            data-drop={`g:${gi}`}
            className={`group dropzone ${selected !== null ? 'armed' : ''}`}
            onClick={() => tapZone(gi)}
          >
            <div className="group-name">{g.name}</div>
            <div className="group-items">{items.map((_, i) => place[i] === gi && tile(i))}</div>
          </div>
        ))}
      </div>
      {!checked && (
        <button type="button" className="primary" disabled={!allPlaced} onClick={check}>
          Check
        </button>
      )}
      {checked && <Feedback correct={correct} />}
      {checked && <Explanation text={card.explanation} />}
    </div>
  );
}

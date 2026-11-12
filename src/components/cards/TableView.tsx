import { useMemo, useState } from 'react';
import type { TableCard } from '../../types';
import { shuffle } from '../../lib/util';
import { Explanation, Feedback } from '../common';
import { useDragDrop } from '../useDragDrop';
import type { CardViewProps } from './CardView';

/** Fill the table: drag words from the bank into the cells (or tap a word, then a cell). */
export function TableView({ card, onAnswer }: CardViewProps<TableCard>) {
  const width = card.columns.length - 1;
  /** Expected word per blank cell, row by row (the first column is the shown row label). */
  const answers = useMemo(() => card.rows.flatMap((r) => r.slice(1)), [card]);
  const tiles = useMemo(() => shuffle([...answers, ...(card.distractors ?? [])]), [card, answers]);
  /** Tile index in each cell. */
  const [filled, setFilled] = useState<(number | null)[]>(() => answers.map(() => null));
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState(false);

  const fill = (cell: number, tile: number) => {
    if (checked) return;
    const next = filled.map((t) => (t === tile ? null : t));
    next[cell] = tile;
    setFilled(next);
    const empty = next.indexOf(null);
    setActive(empty === -1 ? cell : empty);
  };
  const clear = (cell: number) => {
    if (checked) return;
    setFilled((f) => f.map((t, i) => (i === cell ? null : t)));
    setActive(cell);
  };
  const startDrag = useDragDrop<number>((tile, zone) => fill(Number(zone.slice(2)), tile));

  const rightAt = (cell: number) => filled[cell] !== null && tiles[filled[cell]!] === answers[cell];
  const correct = checked && answers.every((_, i) => rightAt(i));

  const check = () => {
    setChecked(true);
    const ok = answers.every((_, i) => rightAt(i));
    onAnswer({ correct: ok, grade: ok ? 'good' : 'again' });
  };

  return (
    <div className="card-body">
      <div className="prompt">{card.prompt || 'Fill in the table'}</div>
      {!checked && <div className="sub">Drag the words into the table, or tap a word to put it in the marked cell.</div>}
      <div className="table-wrap">
        <table className="fill-table">
          <thead>
            <tr>
              {card.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row, r) => (
              <tr key={r}>
                <th scope="row">{row[0]}</th>
                {row.slice(1).map((_, c) => {
                  const cell = r * width + c;
                  const t = filled[cell];
                  const state = checked ? (rightAt(cell) ? 'correct' : 'wrong') : active === cell ? 'active' : '';
                  return (
                    <td key={c}>
                      <button
                        type="button"
                        data-drop={`c:${cell}`}
                        className={`bank-blank table-cell dropzone ${state}`}
                        disabled={checked}
                        aria-label={`${row[0]}, ${card.columns[c + 1]}`}
                        onClick={() => (t === null ? setActive(cell) : clear(cell))}
                      >
                        {t === null ? ' ' : tiles[t]}
                      </button>
                      {checked && !rightAt(cell) && <span className="solution">{answers[cell]}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!checked && (
        <div className="order-pool">
          {tiles.map((w, i) => (
            <button
              key={i}
              type="button"
              className={`token draggable ${filled.includes(i) ? 'used' : ''}`}
              disabled={filled.includes(i)}
              onPointerDown={(e) => startDrag(e, i)}
              onClick={() => fill(active, i)}
            >
              {w}
            </button>
          ))}
        </div>
      )}
      {!checked && (
        <button type="button" className="primary" disabled={filled.includes(null)} onClick={check}>
          Check
        </button>
      )}
      {checked && <Feedback correct={correct} />}
      {checked && <Explanation text={card.explanation} />}
    </div>
  );
}

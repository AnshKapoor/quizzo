import { Fragment, useMemo, useState } from 'react';
import type { ClozeCard } from '../../types';
import { checkTyped, isAccepted, type AnswerQuality } from '../../lib/answer';
import { clozeSolution, parseCloze } from '../../lib/cloze';
import { shuffle } from '../../lib/util';
import { Explanation, Feedback, SpeakButton } from '../common';
import { useDragDrop } from '../useDragDrop';
import { useFlip } from '../useFlip';
import type { CardViewProps } from './CardView';

/** Complete-the-sentence with a word bank: tap or drag words into the blanks. */
export function ClozeBankView({ card, lang, onAnswer }: CardViewProps<ClozeCard>) {
  const segments = useMemo(() => parseCloze(card.text), [card]);
  const blanks = segments.flatMap((s) => (s.kind === 'blank' ? [s] : []));
  const tiles = useMemo(
    () => shuffle([...blanks.map((b) => b.answers[0]), ...(card.distractors ?? [])]),
    [card],
  );
  /** Tile index in each blank. */
  const [filled, setFilled] = useState<(number | null)[]>(() => blanks.map(() => null));
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<AnswerQuality[] | null>(null);

  const fill = (blank: number, tile: number) => {
    if (results) return;
    const next = filled.map((t) => (t === tile ? null : t));
    next[blank] = tile;
    setFilled(next);
    const empty = next.indexOf(null);
    setActive(empty === -1 ? blank : empty);
  };
  const clear = (blank: number) => {
    if (results) return;
    setFilled((f) => f.map((t, i) => (i === blank ? null : t)));
    setActive(blank);
  };
  // Words glide from the bank into the blanks and back.
  const flip = useFlip<HTMLDivElement>([filled, results]);
  const startDrag = useDragDrop<number>((tile, zone) => {
    flip.skipNext(tile); // already where it was dropped
    fill(Number(zone.slice(2)), tile);
  });

  const check = () => {
    const r = blanks.map((b, i) => {
      const t = filled[i];
      return checkTyped(t === null ? '' : tiles[t], b.answers, card.caseSensitive);
    });
    setResults(r);
    const ok = r.every(isAccepted);
    onAnswer({ correct: ok, grade: ok ? 'good' : 'again' });
  };

  const correct = results?.every(isAccepted) ?? false;

  return (
    <div className="card-body" ref={flip.ref}>
      {card.translation && <div className="sub translation">{card.translation}</div>}
      <div className="cloze">
        {segments.map((s, k) => {
          if (s.kind === 'text') return <Fragment key={k}>{s.text}</Fragment>;
          const t = filled[s.index];
          const r = results?.[s.index];
          const state = r ? (isAccepted(r) ? 'correct' : 'wrong') : active === s.index ? 'active' : '';
          return (
            <span key={k} className="blank-wrap">
              <button
                type="button"
                data-drop={`b:${s.index}`}
                data-flip={t === null ? undefined : t}
                className={`bank-blank dropzone ${state}`}
                disabled={!!results}
                onClick={() => (t === null ? setActive(s.index) : clear(s.index))}
              >
                {t === null ? (s.hint ?? ' ') : tiles[t]}
              </button>
              {r && !isAccepted(r) && <span className="solution">{s.answers[0]}</span>}
            </span>
          );
        })}
      </div>
      {!results && (
        <div className="order-pool">
          {tiles.map((w, i) => (
            <button
              key={i}
              type="button"
              data-flip={i}
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
      {!results && (
        <button type="button" className="primary" disabled={filled.includes(null)} onClick={check}>
          Check
        </button>
      )}
      {results && <Feedback correct={correct} />}
      {results && (
        <div className="example">
          {clozeSolution(card.text)} <SpeakButton text={clozeSolution(card.text)} lang={lang} />
        </div>
      )}
      {results && <Explanation text={card.explanation} />}
    </div>
  );
}

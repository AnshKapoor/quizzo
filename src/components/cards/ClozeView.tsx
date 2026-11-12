import { Fragment, useMemo, useRef, useState } from 'react';
import type { ClozeCard } from '../../types';
import { checkTyped, isAccepted, type AnswerQuality } from '../../lib/answer';
import { clozeSolution, parseCloze } from '../../lib/cloze';
import { Explanation, Feedback, SpeakButton, SpecialCharBar } from '../common';
import type { CardViewProps } from './CardView';

export function ClozeView({ card, lang, onAnswer }: CardViewProps<ClozeCard>) {
  const segments = useMemo(() => parseCloze(card.text), [card]);
  const blanks = segments.filter((s) => s.kind === 'blank');
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ''));
  const [results, setResults] = useState<AnswerQuality[] | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const active = useRef(0);

  const check = () => {
    if (results) return;
    const r = blanks.map((b, i) =>
      b.kind === 'blank' ? checkTyped(values[i], b.answers, card.caseSensitive) : 'wrong',
    );
    setResults(r);
    const correct = r.every(isAccepted);
    onAnswer({ correct, grade: correct ? 'good' : 'again' });
  };

  const insert = (ch: string) => {
    const i = active.current;
    const el = inputs.current[i];
    if (!el || results) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + ch + el.value.slice(end);
    setValues((v) => v.map((x, j) => (j === i ? next : x)));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const correct = results?.every(isAccepted) ?? false;

  return (
    <div className="card-body">
      {card.translation && <div className="sub translation">{card.translation}</div>}
      <form
        className="cloze"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        {segments.map((s, k) => {
          if (s.kind === 'text') return <Fragment key={k}>{s.text}</Fragment>;
          const r = results?.[s.index];
          const state = !r ? '' : isAccepted(r) ? 'correct' : 'wrong';
          return (
            <span key={k} className="blank-wrap">
              <input
                ref={(el) => {
                  inputs.current[s.index] = el;
                }}
                className={`blank ${state}`}
                value={values[s.index]}
                placeholder={s.hint ?? ''}
                size={Math.max(4, (s.answers[0]?.length ?? 4) + 1)}
                autoFocus={s.index === 0}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                readOnly={!!results}
                onFocus={() => (active.current = s.index)}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === s.index ? e.target.value : x)))}
              />
              {r && !isAccepted(r) && <span className="solution">{s.answers.join(' / ')}</span>}
            </span>
          );
        })}
        {/* lets Enter submit */}
        <button type="submit" hidden />
      </form>
      {!results && (
        <>
          <SpecialCharBar lang={lang} onInsert={insert} />
          <button type="button" className="primary" onClick={check}>
            Check
          </button>
        </>
      )}
      {results && (
        <Feedback correct={correct}>
          {results.includes('umlaut') && <span> Accepted — but try writing ä, ö, ü, ß.</span>}
          {results.includes('case') && <span> Watch the capitalisation.</span>}
        </Feedback>
      )}
      {results && (
        <div className="example">
          {clozeSolution(card.text)} <SpeakButton text={clozeSolution(card.text)} lang={lang} />
        </div>
      )}
      {results && <Explanation text={card.explanation} />}
    </div>
  );
}

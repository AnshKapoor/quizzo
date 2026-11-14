import { useState } from 'react';
import type { CardType, Deck, QuizPreset } from '../types';
import { CARD_TYPE_LABELS } from '../lib/cardForm';
import { quizPool, quizSummary } from '../lib/quiz';

interface Props {
  deck: Deck;
  quiz: QuizPreset;
  onSave: (quiz: QuizPreset) => void;
  onCancel: () => void;
}

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Name, number of questions and time limits, as typed (strings) so fields can be empty. */
export interface QuizBasics {
  title: string;
  questions: string;
  minutes: string;
  /** card = each card's own time, fixed = `perQuestion` seconds for every question, none = no per-question clock. */
  perMode: 'card' | 'fixed' | 'none';
  perQuestion: string;
}

export const basicsFromQuiz = (q: QuizPreset): QuizBasics => ({
  title: q.title,
  questions: String(q.questions || ''),
  minutes: q.timeLimit ? String(+(q.timeLimit / 60).toFixed(2)) : '',
  perMode: q.cardTimes ? 'card' : q.perQuestion ? 'fixed' : 'none',
  perQuestion: q.perQuestion ? String(q.perQuestion) : '',
});

export const basicsToQuiz = (b: QuizBasics, fallbackTitle = 'Test') => ({
  title: b.title.trim() || fallbackTitle,
  questions: Math.round(num(b.questions)),
  timeLimit: Math.round(num(b.minutes) * 60),
  perQuestion: b.perMode === 'fixed' ? Math.round(num(b.perQuestion)) : 0,
  cardTimes: b.perMode === 'card' ? true : undefined,
});

/** The name / questions / time fields shared by deck quizzes and custom quizzes. */
export function QuizBasicsFields({
  value,
  onChange,
  allLabel = 'all',
}: {
  value: QuizBasics;
  onChange: (b: QuizBasics) => void;
  allLabel?: string;
}) {
  const set = (k: keyof QuizBasics) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input value={value.title} autoFocus placeholder="Chapter 1 test" onChange={set('title')} />
      </label>
      <div className="row wrap quiz-numbers">
        <label className="field">
          <span>Questions</span>
          <input type="number" min={0} inputMode="numeric" value={value.questions} placeholder={allLabel} onChange={set('questions')} />
        </label>
        <label className="field">
          <span>Time limit (minutes)</span>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={value.minutes}
            placeholder="none"
            onChange={set('minutes')}
          />
        </label>
        <label className="field">
          <span>Time per question</span>
          <select value={value.perMode} onChange={set('perMode')}>
            <option value="card">Each card's own time</option>
            <option value="fixed">Same for every question</option>
            <option value="none">No limit</option>
          </select>
        </label>
        {value.perMode === 'fixed' && (
          <label className="field">
            <span>Seconds per question</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={value.perQuestion}
              placeholder="30"
              onChange={set('perQuestion')}
            />
          </label>
        )}
      </div>
      {value.perMode === 'card' && (
        <small className="sub">
          Each question gets the time set on its card, or the default from Settings. Set a card's time when you edit it.
        </small>
      )}
    </>
  );
}

/** Set up a timed quiz: how many questions, how much time, and which cards to draw from. */
export function QuizPresetForm({ deck, quiz, onSave, onCancel }: Props) {
  const [basics, setBasics] = useState(() => basicsFromQuiz(quiz));
  const [types, setTypes] = useState<CardType[]>(quiz.types ?? []);
  const [tags, setTags] = useState<string[]>(quiz.tags ?? []);

  const deckTypes = Array.from(new Set(deck.cards.map((c) => c.type)));
  const deckTags = Array.from(new Set(deck.cards.flatMap((c) => c.tags ?? []))).sort();

  const draft: QuizPreset = {
    id: quiz.id,
    ...basicsToQuiz(basics),
    ...(types.length ? { types } : {}),
    ...(tags.length ? { tags } : {}),
  };
  const available = quizPool(deck, draft).length;

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form
      className="quiz-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <QuizBasicsFields value={basics} onChange={setBasics} />
      {deckTypes.length > 1 && (
        <div className="field">
          <span>Card types {types.length === 0 && <small>(all)</small>}</span>
          <div className="row wrap">
            {deckTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${types.includes(t) ? 'active' : ''}`}
                aria-pressed={types.includes(t)}
                onClick={() => setTypes((l) => toggle(l, t))}
              >
                {CARD_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      {deckTags.length > 0 && (
        <div className="field">
          <span>Tags {tags.length === 0 && <small>(all)</small>}</span>
          <div className="row wrap">
            {deckTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tags.includes(t) ? 'active' : ''}`}
                aria-pressed={tags.includes(t)}
                onClick={() => setTags((l) => toggle(l, t))}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="sub">{available ? quizSummary(draft, available) : 'No cards match these filters.'}</p>
      <div className="row">
        <button type="submit" className="primary" disabled={!available}>
          Save quiz
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

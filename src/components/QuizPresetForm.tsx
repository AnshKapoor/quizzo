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

/** Set up a timed quiz: how many questions, how much time, and which cards to draw from. */
export function QuizPresetForm({ deck, quiz, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(quiz.title);
  const [questions, setQuestions] = useState(String(quiz.questions || ''));
  const [minutes, setMinutes] = useState(quiz.timeLimit ? String(+(quiz.timeLimit / 60).toFixed(2)) : '');
  const [perQuestion, setPerQuestion] = useState(quiz.perQuestion ? String(quiz.perQuestion) : '');
  const [types, setTypes] = useState<CardType[]>(quiz.types ?? []);
  const [tags, setTags] = useState<string[]>(quiz.tags ?? []);

  const deckTypes = Array.from(new Set(deck.cards.map((c) => c.type)));
  const deckTags = Array.from(new Set(deck.cards.flatMap((c) => c.tags ?? []))).sort();

  const draft: QuizPreset = {
    id: quiz.id,
    title: title.trim() || 'Test',
    questions: Math.round(num(questions)),
    timeLimit: Math.round(num(minutes) * 60),
    perQuestion: Math.round(num(perQuestion)),
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
      <label className="field">
        <span>Name</span>
        <input value={title} autoFocus placeholder="Chapter 1 test" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="row wrap quiz-numbers">
        <label className="field">
          <span>Questions</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={questions}
            placeholder="all"
            onChange={(e) => setQuestions(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Time limit (minutes)</span>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={minutes}
            placeholder="none"
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Seconds per question</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={perQuestion}
            placeholder="none"
            onChange={(e) => setPerQuestion(e.target.value)}
          />
        </label>
      </div>
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

import { useState } from 'react';
import type { CardType, Deck, Library, QuizPreset } from '../types';
import { CARD_TYPE_LABELS, cardSummary } from '../lib/cardForm';
import { cardDue, deckStats } from '../lib/library';
import { newQuizPreset, percent, quizAttempts, quizPool, quizSummary } from '../lib/quiz';
import { QuizPresetForm } from '../components/QuizPresetForm';
import { deckToFile, downloadJson, slug } from '../lib/storage';
import { inlineDeckImages } from '../lib/image';
import { CARD_HELP } from '../lib/help';
import { Sheet } from '../components/Sheet';

const LANGUAGES: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English' };
const TYPES = Object.keys(CARD_TYPE_LABELS) as CardType[];

interface Props {
  deck: Deck;
  library: Library;
  onBack: () => void;
  onChange: (deck: Deck) => void;
  onStudy: (mode: 'review' | 'quiz') => void;
  onTimedQuiz: (quizId: string) => void;
  onHelp: (topic?: string) => void;
  onAddCard: (type: CardType) => void;
  onEditCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteDeck: () => void;
  onResetProgress: () => void;
}

function dueLabel(due: number | undefined): string {
  if (due === undefined) return 'new';
  const days = Math.round((due - Date.now()) / 86_400_000);
  if (due <= Date.now()) return 'due';
  return days <= 0 ? 'today' : `in ${days}d`;
}

export function DeckView(p: Props) {
  const { deck, library } = p;
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  /** The timed quiz being created or edited. */
  const [editing, setEditing] = useState<QuizPreset | null>(null);
  /** Which bottom sheet is open: the card type picker or the deck menu. */
  const [sheet, setSheet] = useState<'add' | 'menu' | null>(null);
  const quizzes = deck.quizzes ?? [];
  const saveQuiz = (q: QuizPreset) => {
    const exists = quizzes.some((x) => x.id === q.id);
    p.onChange({ ...deck, quizzes: exists ? quizzes.map((x) => (x.id === q.id ? q : x)) : [...quizzes, q] });
    setEditing(null);
  };
  const deleteQuiz = (id: string) => {
    const rest = quizzes.filter((x) => x.id !== id);
    p.onChange({ ...deck, quizzes: rest.length ? rest : undefined });
  };
  const stats = deckStats(deck, library);
  const cards = filter === 'all' ? deck.cards : deck.cards.filter((c) => c.type === filter);

  return (
    <div className="screen">
      <header className="bar">
        <button type="button" className="ghost back" onClick={p.onBack}>
          ← Decks
        </button>
        <div className="row">
          <div className="row" data-tour="deck-run">
            <button type="button" className="primary" onClick={() => p.onStudy('review')}>
              Study
            </button>
            <button type="button" disabled={!stats.total} onClick={() => p.onStudy('quiz')}>
              Quiz
            </button>
          </div>
          <button
            type="button"
            className="bar-btn"
            data-tour="deck-menu"
            title="Deck options"
            aria-label="Deck options"
            onClick={() => setSheet('menu')}
          >
            <span aria-hidden="true">⋮</span>
          </button>
        </div>
      </header>

      <section className="deck-meta">
        <input
          className="title-input"
          value={deck.title}
          aria-label="Deck title"
          onChange={(e) => p.onChange({ ...deck, title: e.target.value })}
        />
        <span className="sub">
          {stats.total} cards · {stats.questions} questions · {stats.due} due · {stats.fresh} new
        </span>
        <details className="fold">
          <summary>Description and language</summary>
          <div className="fold-body">
            <textarea
              rows={2}
              placeholder="Description"
              aria-label="Description"
              value={deck.description ?? ''}
              onChange={(e) => p.onChange({ ...deck, description: e.target.value })}
            />
            <label>
              Learning{' '}
              <select
                value={deck.language.target}
                onChange={(e) => p.onChange({ ...deck, language: { ...deck.language, target: e.target.value } })}
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </section>

      <section className="quizzes">
        <div className="row wrap section-head">
          <h2>Timed quizzes</h2>
          <button
            type="button"
            className="icon-btn help-link"
            title="How timed quizzes work"
            aria-label="How timed quizzes work"
            onClick={() => p.onHelp('timed')}
          >
            ?
          </button>
          <span className="spacer" />
          {!editing && (
            <button type="button" data-tour="timed" disabled={!stats.total} onClick={() => setEditing(newQuizPreset())}>
              + New timed quiz
            </button>
          )}
        </div>
        {editing && (
          <QuizPresetForm key={editing.id} deck={deck} quiz={editing} onSave={saveQuiz} onCancel={() => setEditing(null)} />
        )}
        {quizzes.length === 0 && !editing && (
          <p className="sub">Set up a test with a time limit, e.g. 10 questions in 5 minutes. It is saved with the deck.</p>
        )}
        {quizzes.length > 0 && (
          <ul className="card-list quiz-list">
            {quizzes.map((q) => {
              const runs = quizAttempts(library, deck.id, q.id);
              const last = runs[runs.length - 1];
              return (
                <li key={q.id}>
                  <div className="quiz-info">
                    <strong>{q.title}</strong>
                    <span className="sub">
                      {quizSummary(q, quizPool(deck, q).length)}
                      {last && ` · last: ${last.correct}/${last.total} (${percent(last.correct, last.total)}%)`}
                    </span>
                  </div>
                  <button type="button" className="primary" onClick={() => p.onTimedQuiz(q.id)}>
                    Start
                  </button>
                  <button type="button" className="ghost" onClick={() => setEditing(q)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Delete quiz"
                    aria-label="Delete quiz"
                    onClick={() => confirm(`Delete the quiz "${q.title}"?`) && deleteQuiz(q.id)}
                  >
                    🗑
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="row section-head">
          <h2>Cards</h2>
          <span className="spacer" />
          <button type="button" className="primary fab" data-tour="add-card" onClick={() => setSheet('add')}>
            + Add card
          </button>
        </div>

        {deck.cards.length > 0 && (
          <div className="row filter-row">
            {(['all', ...TYPES] as const)
              .filter((t) => t === 'all' || t === filter || deck.cards.some((c) => c.type === t))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${filter === t ? 'active' : ''}`}
                  onClick={() => setFilter(t)}
                >
                  {t === 'all' ? `All (${deck.cards.length})` : `${CARD_TYPE_LABELS[t]} (${deck.cards.filter((c) => c.type === t).length})`}
                </button>
              ))}
          </div>
        )}

        <ul className="card-list">
          {cards.map((c) => (
            <li key={c.id}>
              <span className={`badge badge-${c.type}`}>{CARD_TYPE_LABELS[c.type]}</span>
              <button type="button" className="summary" onClick={() => p.onEditCard(c.id)}>
                {cardSummary(c)}
              </button>
              <span className="due-label">{dueLabel(cardDue(deck, library, c))}</span>
              <button
                type="button"
                className="icon-btn"
                title="Delete card"
                aria-label="Delete card"
                onClick={() => confirm('Delete this card?') && p.onDeleteCard(c.id)}
              >
                🗑
              </button>
            </li>
          ))}
          {cards.length === 0 && (
            <li className="sub">
              No cards here yet. Press "+ Add card" to make the first one.
              <button type="button" className="ghost help-link" onClick={() => p.onHelp('cards')}>
                How do I add cards?
              </button>
            </li>
          )}
        </ul>
      </section>

      {sheet === 'add' && (
        <Sheet title="Add a card" onClose={() => setSheet(null)}>
          <div className="type-grid">
            {TYPES.map((t) => (
              <button key={t} type="button" className="sheet-item" onClick={() => p.onAddCard(t)}>
                <strong className={`badge-${t}`}>{CARD_TYPE_LABELS[t]}</strong>
                <span className="sub">{CARD_HELP[t].goodFor}</span>
              </button>
            ))}
          </div>
          <button type="button" className="ghost help-link" onClick={() => p.onHelp('types')}>
            See an example of every type
          </button>
        </Sheet>
      )}

      {sheet === 'menu' && (
        <Sheet title={deck.title || 'Deck'} onClose={() => setSheet(null)}>
          <button
            type="button"
            className="sheet-item"
            onClick={() => {
              downloadJson(`${slug(deck.title)}.quizzo.json`, deckToFile(inlineDeckImages(deck, p.library.images)));
              setSheet(null);
            }}
          >
            <strong>⤓ Export as a file</strong>
            <span className="sub">A .json file you can share or import on another device.</span>
          </button>
          <button
            type="button"
            className="sheet-item"
            onClick={() => {
              if (confirm('Reset learning progress for this deck?')) p.onResetProgress();
              setSheet(null);
            }}
          >
            <strong>↺ Reset progress</strong>
            <span className="sub">Every card counts as new again. The cards stay.</span>
          </button>
          <button type="button" className="sheet-item" onClick={() => p.onHelp('decks')}>
            <strong>? Help with decks</strong>
          </button>
          <button
            type="button"
            className="sheet-item danger"
            onClick={() => (confirm(`Delete "${deck.title}" and all its cards?`) ? p.onDeleteDeck() : setSheet(null))}
          >
            <strong>🗑 Delete deck</strong>
          </button>
        </Sheet>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { CardType, Deck, Library } from '../types';
import { CARD_TYPE_LABELS, cardSummary } from '../lib/cardForm';
import { cardDue, deckStats } from '../lib/library';
import { deckToFile, downloadJson, slug } from '../lib/storage';

const LANGUAGES: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', en: 'English' };
const TYPES = Object.keys(CARD_TYPE_LABELS) as CardType[];

interface Props {
  deck: Deck;
  library: Library;
  onBack: () => void;
  onChange: (deck: Deck) => void;
  onStudy: (mode: 'review' | 'quiz') => void;
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
  const stats = deckStats(deck, library);
  const cards = filter === 'all' ? deck.cards : deck.cards.filter((c) => c.type === filter);

  return (
    <div className="screen">
      <header className="bar">
        <button type="button" className="ghost" onClick={p.onBack}>
          ← Decks
        </button>
        <div className="row">
          <button type="button" className="primary" onClick={() => p.onStudy('review')}>
            Study
          </button>
          <button type="button" disabled={!stats.total} onClick={() => p.onStudy('quiz')}>
            Quiz
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
        <textarea
          rows={2}
          placeholder="Description"
          value={deck.description ?? ''}
          onChange={(e) => p.onChange({ ...deck, description: e.target.value })}
        />
        <div className="row wrap">
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
          <span className="sub">
            {stats.total} cards · {stats.questions} questions · {stats.due} due · {stats.fresh} new
          </span>
          <span className="spacer" />
          <button type="button" onClick={() => downloadJson(`${slug(deck.title)}.quizzo.json`, deckToFile(deck))}>
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => confirm('Reset learning progress for this deck?') && p.onResetProgress()}
          >
            Reset progress
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => confirm(`Delete "${deck.title}" and all its cards?`) && p.onDeleteDeck()}
          >
            Delete deck
          </button>
        </div>
      </section>

      <section>
        <div className="row wrap add-row">
          <strong>Add card:</strong>
          {TYPES.map((t) => (
            <button key={t} type="button" onClick={() => p.onAddCard(t)}>
              + {CARD_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="row wrap filter-row">
          {(['all', ...TYPES] as const).map((t) => (
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
          {cards.length === 0 && <li className="sub">No cards here yet.</li>}
        </ul>
      </section>
    </div>
  );
}

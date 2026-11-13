import { useMemo, useState } from 'react';
import type { CardType, CustomQuiz, Library } from '../types';
import { CARD_TYPE_LABELS, cardSummary } from '../lib/cardForm';
import { customQuizItems, quizSummary } from '../lib/quiz';
import { expandCard, VARIANT_LABELS } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';
import { basicsFromQuiz, basicsToQuiz, QuizBasicsFields } from '../components/QuizPresetForm';

interface Props {
  library: Library;
  quiz: CustomQuiz;
  isNew: boolean;
  onSave: (quiz: CustomQuiz, start: boolean) => void;
  onCancel: () => void;
  onHelp: () => void;
}

const pickKey = (deckId: string, cardId: string) => `${deckId}\n${cardId}`;
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Build a quiz from any questions in the library, across decks. */
export function QuizBuilder({ library, quiz, isNew, onSave, onCancel, onHelp }: Props) {
  const [basics, setBasics] = useState(() => basicsFromQuiz(quiz));
  const [picks, setPicks] = useState(quiz.picks);
  const [query, setQuery] = useState('');
  const [deckIds, setDeckIds] = useState<string[]>([]);
  const [types, setTypes] = useState<CardType[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [onlySelected, setOnlySelected] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const picked = useMemo(() => new Set(picks.map((p) => pickKey(p.deckId, p.cardId))), [picks]);
  const draft: CustomQuiz = { ...quiz, ...basicsToQuiz(basics, 'My quiz'), picks };
  const questionCount = customQuizItems(library, draft).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(quiz);

  const allCards = library.decks.flatMap((d) => d.cards);
  const allTypes = Array.from(new Set(allCards.map((c) => c.type)));
  const allTags = Array.from(new Set(allCards.flatMap((c) => c.tags ?? []))).sort((a, b) => a.localeCompare(b));

  // Cards that pass the filters, grouped by deck.
  const q = query.trim().toLowerCase();
  const groups = library.decks
    .filter((d) => !deckIds.length || deckIds.includes(d.id))
    .map((deck) => ({
      deck,
      cards: deck.cards.filter((c) => {
        if (types.length && !types.includes(c.type)) return false;
        if (tags.length && !c.tags?.some((t) => tags.includes(t))) return false;
        if (onlySelected && !picked.has(pickKey(deck.id, c.id))) return false;
        if (q && !`${cardSummary(c)} ${c.tags?.join(' ') ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    }))
    .filter((g) => g.cards.length);
  const shown = groups.flatMap((g) => g.cards.map((c) => ({ deckId: g.deck.id, cardId: c.id })));
  const shownPicked = shown.filter((p) => picked.has(pickKey(p.deckId, p.cardId))).length;

  const setMany = (list: { deckId: string; cardId: string }[], on: boolean) =>
    setPicks((cur) => {
      const keys = new Set(list.map((p) => pickKey(p.deckId, p.cardId)));
      const rest = cur.filter((p) => !keys.has(pickKey(p.deckId, p.cardId)));
      return on ? [...rest, ...list] : rest;
    });
  const flip = (deckId: string, cardId: string) => setMany([{ deckId, cardId }], !picked.has(pickKey(deckId, cardId)));

  const cancel = () => {
    if (!dirty || confirm('Discard your changes to this quiz?')) onCancel();
  };

  return (
    <div className="screen builder">
      <header className="bar">
        <button type="button" className="ghost" onClick={cancel}>
          ← Home
        </button>
        <strong>{isNew ? 'New custom quiz' : 'Edit custom quiz'}</strong>
        <button type="button" className="icon-btn help-link" title="Help" aria-label="Help" onClick={onHelp}>
          ?
        </button>
      </header>

      <section className="quiz-form">
        <QuizBasicsFields value={basics} onChange={setBasics} allLabel="all picked" />
        <p className="sub">Pick the questions below. They can come from any of your decks.</p>
      </section>

      <section className="bank">
        <div className="row wrap section-head">
          <h2>Question bank</h2>
          <span className="sub">
            {library.decks.length} deck{library.decks.length === 1 ? '' : 's'} · {allCards.length} cards
          </span>
        </div>

        <div className="bank-filters">
          <input
            type="search"
            className="bank-search"
            placeholder="Search questions or tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search questions"
          />
          {library.decks.length > 1 && (
            <div className="row wrap" aria-label="Decks">
              <span className="filter-label">Decks</span>
              {library.decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip ${deckIds.includes(d.id) ? 'active' : ''}`}
                  aria-pressed={deckIds.includes(d.id)}
                  onClick={() => setDeckIds((l) => toggle(l, d.id))}
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}
          {allTypes.length > 1 && (
            <div className="row wrap" aria-label="Card types">
              <span className="filter-label">Types</span>
              {allTypes.map((t) => (
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
          )}
          {allTags.length > 0 && (
            <div className="row wrap" aria-label="Tags">
              <span className="filter-label">Tags</span>
              {allTags.map((t) => (
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
          )}
          <div className="row wrap">
            <label className="check">
              <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} /> Show
              only selected
            </label>
            <span className="spacer" />
            <button type="button" disabled={shownPicked === shown.length} onClick={() => setMany(shown, true)}>
              Select all shown ({shown.length})
            </button>
            <button type="button" className="ghost" disabled={!shownPicked} onClick={() => setMany(shown, false)}>
              Clear shown
            </button>
          </div>
        </div>

        {groups.length === 0 && (
          <p className="empty sub">
            {allCards.length ? 'No questions match these filters.' : 'Your decks have no cards yet. Add some cards first.'}
          </p>
        )}

        {groups.map(({ deck, cards }) => {
          const inDeck = cards.filter((c) => picked.has(pickKey(deck.id, c.id))).length;
          const list = cards.map((c) => ({ deckId: deck.id, cardId: c.id }));
          return (
            <div key={deck.id} className="bank-group">
              <div className="row bank-group-head">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={inDeck === cards.length}
                    ref={(el) => {
                      if (el) el.indeterminate = inDeck > 0 && inDeck < cards.length;
                    }}
                    onChange={() => setMany(list, inDeck < cards.length)}
                    aria-label={`Select all shown cards in ${deck.title}`}
                  />
                  <strong>{deck.title}</strong>
                </label>
                <span className="sub">
                  {inDeck} / {cards.length} selected
                </span>
              </div>
              <ul className="card-list bank-list">
                {cards.map((c) => {
                  const k = pickKey(deck.id, c.id);
                  const sample = preview === k ? expandCard(c, deck)[0] : undefined;
                  return (
                    <li key={c.id} className={picked.has(k) ? 'picked' : ''}>
                      <label className="pick-row">
                        <input type="checkbox" checked={picked.has(k)} onChange={() => flip(deck.id, c.id)} />
                        <span className={`badge badge-${c.type}`}>{CARD_TYPE_LABELS[c.type]}</span>
                        <span className="pick-summary">{cardSummary(c)}</span>
                      </label>
                      <button
                        type="button"
                        className="icon-btn"
                        title={sample ? 'Hide preview' : 'Preview'}
                        aria-label={sample ? 'Hide preview' : 'Preview'}
                        aria-expanded={!!sample}
                        onClick={() => setPreview(sample ? null : k)}
                      >
                        {sample ? '▴' : '👁'}
                      </button>
                      {sample && (
                        <div className="bank-preview">
                          <CardView
                            card={sample.card}
                            label={sample.variant ? VARIANT_LABELS[sample.variant] : undefined}
                            lang={deck.language.target}
                            onAnswer={() => {}}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <footer className="builder-footer">
        <div className="builder-count">
          <strong>
            {picks.length} card{picks.length === 1 ? '' : 's'} selected
          </strong>
          <span className="sub">{questionCount ? quizSummary(draft, questionCount) : 'Pick at least one question.'}</span>
        </div>
        <div className="row wrap">
          <button type="button" className="ghost" disabled={!picks.length} onClick={() => setPicks([])}>
            Clear all
          </button>
          <button type="button" disabled={!questionCount} onClick={() => onSave(draft, false)}>
            Save
          </button>
          <button type="button" className="primary" disabled={!questionCount} onClick={() => onSave(draft, true)}>
            Save &amp; start
          </button>
        </div>
      </footer>
    </div>
  );
}

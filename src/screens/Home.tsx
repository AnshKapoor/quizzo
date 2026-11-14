import { useRef } from 'react';
import type { Library } from '../types';
import { deckStats } from '../lib/library';
import { deckToFile, downloadJson, slug } from '../lib/storage';
import { inlineDeckImages } from '../lib/image';
import { CUSTOM_QUIZ_OWNER, customQuizItems, customQuizToDeck, percent, quizAttempts, quizSummary } from '../lib/quiz';

interface Props {
  library: Library;
  onOpen: (deckId: string) => void;
  onStudy: (deckId: string, mode: 'review' | 'quiz') => void;
  onNewDeck: () => void;
  onImport: (file: File) => void;
  onHelp: (topic?: string) => void;
  onAppearance: () => void;
  onBackup: () => void;
  onNewCustomQuiz: () => void;
  onEditCustomQuiz: (quizId: string) => void;
  onStartCustomQuiz: (quizId: string) => void;
  onDeleteCustomQuiz: (quizId: string) => void;
}

export function Home(p: Props) {
  const { library, onOpen, onStudy, onNewDeck, onImport, onHelp } = p;
  const customQuizzes = library.customQuizzes ?? [];
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="screen">
      <header className="hero">
        <div>
          <h1>Quizzo</h1>
          <p className="sub">Flashcards that quiz you back.</p>
        </div>
        <div className="row">
          <button type="button" className="primary" onClick={onNewDeck}>
            + New deck
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <button type="button" onClick={p.onBackup}>
            ☁ Backup
          </button>
          <button type="button" className="ghost" onClick={p.onAppearance}>
            ⚙ Settings
          </button>
          <button type="button" className="ghost" onClick={() => onHelp()}>
            ? Help
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {library.decks.length === 0 && (
        <div className="empty">
          <p>No decks yet. Create one or import a .json deck file.</p>
          <p>
            New here?{' '}
            <button type="button" onClick={() => onHelp()}>
              Read the help
            </button>
          </p>
        </div>
      )}

      {library.decks.some((d) => d.cards.length) && (
        <section className="quizzes custom-quizzes">
          <div className="row wrap section-head">
            <h2>Custom quizzes</h2>
            <button
              type="button"
              className="icon-btn help-link"
              title="How custom quizzes work"
              aria-label="How custom quizzes work"
              onClick={() => onHelp('custom')}
            >
              ?
            </button>
            <span className="spacer" />
            <button type="button" onClick={p.onNewCustomQuiz}>
              + New custom quiz
            </button>
          </div>
          {customQuizzes.length === 0 ? (
            <p className="sub">
              Pick any questions from all your decks and test them together, with or without a timer.
            </p>
          ) : (
            <ul className="card-list quiz-list">
              {customQuizzes.map((q) => {
                const available = customQuizItems(library, q).length;
                const runs = quizAttempts(library, CUSTOM_QUIZ_OWNER, q.id);
                const last = runs[runs.length - 1];
                return (
                  <li key={q.id}>
                    <div className="quiz-info">
                      <strong>{q.title}</strong>
                      <span className="sub">
                        {quizSummary(q, available)}
                        {last && ` · last: ${last.correct}/${last.total} (${percent(last.correct, last.total)}%)`}
                      </span>
                    </div>
                    <div className="row">
                      <button
                        type="button"
                        className="primary"
                        disabled={!available}
                        onClick={() => p.onStartCustomQuiz(q.id)}
                      >
                        Start
                      </button>
                      <button type="button" onClick={() => p.onEditCustomQuiz(q.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Export as a deck file to share"
                        aria-label={`Export ${q.title} as a deck file`}
                        disabled={!available}
                        onClick={() => downloadJson(`${slug(q.title)}.quizzo.json`, deckToFile(inlineDeckImages(customQuizToDeck(library, q), library.images)))}
                      >
                        ⤓
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Delete quiz"
                        aria-label={`Delete ${q.title}`}
                        onClick={() => confirm(`Delete the quiz "${q.title}"? The questions stay in their decks.`) && p.onDeleteCustomQuiz(q.id)}
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {library.decks.length > 0 && <h2 className="decks-head">Decks</h2>}
      <div className="deck-grid">
        {library.decks.map((d) => {
          const s = deckStats(d, library);
          const reviewable = s.due + Math.min(s.fresh, 10);
          return (
            <article key={d.id} className="deck-tile">
              <button type="button" className="deck-head" onClick={() => onOpen(d.id)}>
                <span className="lang">{d.language.target.toUpperCase()}</span>
                <h2>{d.title}</h2>
                {d.description && <p>{d.description}</p>}
              </button>
              <div className="stats">
                <span>{s.total} cards</span>
                <span className="due">{s.due} due</span>
                <span className="new">{s.fresh} new</span>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={reviewable === 0}
                  onClick={() => onStudy(d.id, 'review')}
                >
                  {reviewable ? `Study (${reviewable})` : 'All caught up ✓'}
                </button>
                <button type="button" disabled={!s.total} onClick={() => onStudy(d.id, 'quiz')}>
                  Quiz
                </button>
                <button type="button" className="ghost" onClick={() => onOpen(d.id)}>
                  Edit
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

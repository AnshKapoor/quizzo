import { useRef } from 'react';
import type { Library } from '../types';
import { deckStats } from '../lib/library';
import { downloadJson } from '../lib/storage';

interface Props {
  library: Library;
  onOpen: (deckId: string) => void;
  onStudy: (deckId: string, mode: 'review' | 'quiz') => void;
  onNewDeck: () => void;
  onImport: (file: File) => void;
}

export function Home({ library, onOpen, onStudy, onNewDeck, onImport }: Props) {
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
          <button
            type="button"
            onClick={() => downloadJson(`quizzo-backup-${new Date().toISOString().slice(0, 10)}.json`, library)}
            disabled={!library.decks.length}
          >
            Back up all
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
        </div>
      )}

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

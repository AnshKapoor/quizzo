import { useEffect, useState } from 'react';
import type { AnswerResult, Deck, Grade, Library, StudyItem } from '../types';
import { buildQueue } from '../lib/library';
import { VARIANT_LABELS } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';
import { Stage } from '../components/Stage';

interface Props {
  deck: Deck;
  library: Library;
  mode: 'review' | 'quiz';
  /** `itemKey` is the card id, or `cardId#variant` for generated vocabulary questions. */
  onRecord: (itemKey: string, grade: Grade) => void;
  onExit: () => void;
}

export function Study({ deck, library, mode, onRecord, onExit }: Props) {
  // Snapshot the queue once; recording answers must not reshuffle it mid-session.
  const [queue, setQueue] = useState<StudyItem[]>(() => buildQueue(deck, library, mode));
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);

  const item = queue[pos];
  const finished = pos >= queue.length;

  const answer = (r: AnswerResult) => {
    setResult(r);
    onRecord(item.key, r.grade);
    setScore((s) => ({ correct: s.correct + (r.correct ? 1 : 0), answered: s.answered + 1 }));
    // In review mode, missed questions come back once at the end of the session.
    if (mode === 'review' && !r.correct && !requeued.has(item.key)) {
      setRequeued((s) => new Set(s).add(item.key));
      setQueue((q) => [...q, item]);
    }
  };

  const next = () => {
    setResult(null);
    setPos((p) => p + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && result) {
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const restart = () => {
    setQueue(buildQueue(deck, library, mode));
    setPos(0);
    setResult(null);
    setScore({ correct: 0, answered: 0 });
    setRequeued(new Set());
    setRound((r) => r + 1);
  };

  return (
    <div className="screen study">
      <header className="bar">
        <button type="button" className="ghost" onClick={onExit}>
          ← {deck.title}
        </button>
        <span className="mode-pill">{mode === 'review' ? 'Review' : 'Quiz'}</span>
        <span className="counter">{Math.min(pos + 1, queue.length)} / {queue.length}</span>
      </header>
      <div className="progress">
        <div style={{ width: `${queue.length ? (pos / queue.length) * 100 : 100}%` }} />
      </div>

      <Stage resetKey={`${round}-${pos}`}>
        {queue.length === 0 ? (
          <div className="empty">
            <h2>Nothing due 🎉</h2>
            <p>You've reviewed everything for now. Try a quiz, or add more cards.</p>
            <button type="button" className="primary" onClick={onExit}>
              Back
            </button>
          </div>
        ) : finished ? (
          <div className="empty">
            <h2>{mode === 'quiz' ? 'Quiz finished' : 'Session done'}</h2>
            <p className="score">
              {score.correct} / {score.answered} correct
              {score.answered > 0 && <> · {Math.round((score.correct / score.answered) * 100)}%</>}
            </p>
            <div className="row">
              <button type="button" className="primary" onClick={restart}>
                {mode === 'quiz' ? 'New quiz' : 'Continue'}
              </button>
              <button type="button" onClick={onExit}>
                Back to deck
              </button>
            </div>
          </div>
        ) : (
          <>
            <CardView
              key={`${round}-${pos}-${item.key}`}
              card={item.card}
              label={item.variant ? VARIANT_LABELS[item.variant] : undefined}
              lang={deck.language.target}
              onAnswer={answer}
              autoPlay
            />
            {result && (
              <div className="next-row">
                <button type="button" className="primary" autoFocus onClick={next}>
                  Next <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </>
        )}
      </Stage>
    </div>
  );
}

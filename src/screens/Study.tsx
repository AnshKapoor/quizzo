import { useEffect, useState } from 'react';
import type { AnswerResult, Deck, Grade, Library, StudyItem } from '../types';
import { buildQueue } from '../lib/library';
import { VARIANT_LABELS } from '../lib/vocab';
import { DEFAULT_QUESTION_TIME, GRADE_LABELS, speedGrade } from '../lib/quiz';
import { CardView } from '../components/cards/CardView';
import { Stage } from '../components/Stage';

interface Props {
  deck: Deck;
  library: Library;
  mode: 'review' | 'quiz';
  /** Quiz mode: seconds per question for cards without their own time. Review has no clock. */
  defaultTime?: number;
  /** `itemKey` is the card id, or `cardId#variant` for generated vocabulary questions. */
  onRecord: (itemKey: string, grade: Grade) => void;
  onExit: () => void;
}

export function Study({ deck, library, mode, defaultTime = DEFAULT_QUESTION_TIME, onRecord, onExit }: Props) {
  // Snapshot the queue once; recording answers must not reshuffle it mid-session.
  const [queue, setQueue] = useState<StudyItem[]>(() => buildQueue(deck, library, mode));
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [timedOut, setTimedOut] = useState(0);
  /** Quiz mode: the grade from answer speed, shown after answering. */
  const [speed, setSpeed] = useState<{ grade: Grade; seconds: number } | null>(null);
  const [questionAt, setQuestionAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const item = queue[pos];
  const finished = pos >= queue.length;

  // Quiz mode: every question has its own clock (the card's time, or the default from Settings).
  const limit = mode === 'quiz' && item && !finished ? (item.card.time && item.card.time > 0 ? item.card.time : defaultTime) : 0;
  const questionLeft = limit && !result ? (questionAt + limit * 1000 - now) / 1000 : null;

  const answer = (r: AnswerResult) => {
    setResult(r);
    if (limit) {
      const seconds = (Date.now() - questionAt) / 1000;
      const grade = speedGrade(r, item.card, seconds, limit);
      setSpeed({ grade, seconds });
      onRecord(item.key, grade);
    } else onRecord(item.key, r.grade);
    setScore((s) => ({ correct: s.correct + (r.correct ? 1 : 0), answered: s.answered + 1 }));
    // In review mode, missed questions come back once at the end of the session.
    if (mode === 'review' && !r.correct && !requeued.has(item.key)) {
      setRequeued((s) => new Set(s).add(item.key));
      setQueue((q) => [...q, item]);
    }
  };

  const next = () => {
    setResult(null);
    setSpeed(null);
    setPos((p) => p + 1);
    setQuestionAt(Date.now());
    setNow(Date.now());
  };

  useEffect(() => {
    if (!limit || result) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [limit, result, pos, round]);

  // Out of time: the question counts as missed and the next one starts.
  useEffect(() => {
    if (questionLeft === null || questionLeft > 0) return;
    setScore((s) => ({ ...s, answered: s.answered + 1 }));
    setTimedOut((n) => n + 1);
    // Out of time counts like a wrong answer, so the card comes back soon.
    onRecord(item.key, 'again');
    next();
  });

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
    setTimedOut(0);
    setRound((r) => r + 1);
    setQuestionAt(Date.now());
    setNow(Date.now());
  };

  return (
    <div className="screen study">
      <header className="bar">
        <button type="button" className="ghost" onClick={onExit}>
          ← {deck.title}
        </button>
        <span className="mode-pill">{mode === 'review' ? 'Review' : '⏱ Quiz'}</span>
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
            {timedOut > 0 && <p className="sub">⏱ {timedOut} ran out of time</p>}
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
            {questionLeft !== null && (
              <div className={`question-clock ${questionLeft <= Math.min(30, limit / 4) ? 'low' : ''}`}>
                <div style={{ width: `${Math.max(0, questionLeft / limit) * 100}%` }} />
                <span>{Math.max(0, Math.ceil(questionLeft))} s</span>
              </div>
            )}
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
                {speed && (
                  <span className={`speed-grade grade-${speed.grade}`} title="Marked by how quickly you answered">
                    {GRADE_LABELS[speed.grade]} · {Math.max(1, Math.round(speed.seconds))} s of {limit} s
                  </span>
                )}
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

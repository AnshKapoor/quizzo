import { useEffect, useRef, useState } from 'react';
import type { AnswerResult, Deck, Grade, Library, QuizAttempt, QuizPreset, StudyItem } from '../types';
import { CARD_TYPE_LABELS, cardSummary } from '../lib/cardForm';
import { buildQuizQueue, formatTime, percent, quizAttempts, quizPool, quizSummary } from '../lib/quiz';
import { VARIANT_LABELS } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';

interface Props {
  deck: Deck;
  library: Library;
  quiz: QuizPreset;
  onRecord: (itemKey: string, grade: Grade) => void;
  onFinish: (attempt: QuizAttempt) => void;
  onExit: () => void;
}

/** right / wrong = answered; timeout = the question's own clock ran out; unanswered = quiz ended first. */
type Outcome = 'right' | 'wrong' | 'timeout' | 'unanswered';

const OUTCOME_ICON: Record<Outcome, string> = { right: '✓', wrong: '✗', timeout: '⏱', unanswered: '–' };
const OUTCOME_TEXT: Record<Outcome, string> = {
  right: 'Correct',
  wrong: 'Wrong',
  timeout: 'Out of time',
  unanswered: 'Not answered',
};

export function TimedQuiz({ deck, library, quiz, onRecord, onFinish, onExit }: Props) {
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [queue, setQueue] = useState<StudyItem[]>([]);
  const [pos, setPos] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [questionAt, setQuestionAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [run, setRun] = useState(0);
  const reported = useRef(false);

  const available = quizPool(deck, quiz).length;
  const history = quizAttempts(library, deck.id, quiz.id);
  const best = history.reduce<QuizAttempt | null>(
    (b, a) => (!b || percent(a.correct, a.total) > percent(b.correct, b.total) ? a : b),
    null,
  );

  const totalLeft = quiz.timeLimit ? (startedAt + quiz.timeLimit * 1000 - now) / 1000 : null;
  const questionLeft = quiz.perQuestion && !result ? (questionAt + quiz.perQuestion * 1000 - now) / 1000 : null;

  const start = () => {
    const q = buildQuizQueue(deck, quiz);
    const t = Date.now();
    setQueue(q);
    setOutcomes(q.map(() => 'unanswered'));
    setPos(0);
    setResult(null);
    setStartedAt(t);
    setQuestionAt(t);
    setNow(t);
    setTimeUp(false);
    setRun((r) => r + 1);
    reported.current = false;
    setPhase('running');
  };

  const finish = (byClock: boolean, final: Outcome[] = outcomes) => {
    if (reported.current) return;
    reported.current = true;
    // The clock ticks every 250 ms; don't report more time than the limit allowed.
    const t = byClock && quiz.timeLimit ? startedAt + quiz.timeLimit * 1000 : Date.now();
    setEndedAt(t);
    setTimeUp(byClock);
    setPhase('done');
    onFinish({
      deckId: deck.id,
      quizId: quiz.id,
      at: Date.now(),
      correct: final.filter((o) => o === 'right').length,
      total: final.length,
      seconds: Math.round((t - startedAt) / 1000),
    });
  };

  const goTo = (next: number, final: Outcome[]) => {
    if (next >= queue.length) return finish(false, final);
    setResult(null);
    setPos(next);
    setQuestionAt(Date.now());
  };

  const answer = (r: AnswerResult) => {
    if (phase !== 'running' || result) return;
    setResult(r);
    onRecord(queue[pos].key, r.grade);
    setOutcomes((o) => o.map((x, i) => (i === pos ? (r.correct ? 'right' : 'wrong') : x)));
  };

  // Clock: tick while running, then end the quiz or skip the question when time runs out.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (totalLeft !== null && totalLeft <= 0) finish(true);
    else if (questionLeft !== null && questionLeft <= 0) {
      const final = outcomes.map((x, i) => (i === pos ? 'timeout' : x));
      setOutcomes(final);
      goTo(pos + 1, final);
    }
  });

  const leave = () => {
    if (phase !== 'running' || confirm('Leave the quiz? This attempt will not be saved.')) onExit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && phase === 'running' && result) {
        e.preventDefault();
        goTo(pos + 1, outcomes);
      } else if (e.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const item = queue[pos];
  const correct = outcomes.filter((o) => o === 'right').length;
  const low = (s: number | null, limit: number) => s !== null && s <= Math.min(30, limit / 4);

  return (
    <div className="screen study timed">
      <header className="bar">
        <button type="button" className="ghost" onClick={leave}>
          ← {deck.title}
        </button>
        <span className="mode-pill">⏱ {quiz.title}</span>
        {phase === 'running' && (
          <>
            <span className="counter">
              {pos + 1} / {queue.length}
            </span>
            {totalLeft !== null && (
              <span className={`clock ${low(totalLeft, quiz.timeLimit) ? 'low' : ''}`} role="timer" aria-label="Time left">
                {formatTime(totalLeft)}
              </span>
            )}
          </>
        )}
      </header>
      {phase === 'running' && (
        <div className="progress">
          <div style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
      )}

      {phase === 'ready' && (
        <div className="empty quiz-intro">
          <h2>{quiz.title}</h2>
          <p className="score">{quizSummary(quiz, available)}</p>
          {available === 0 ? (
            <p>No cards in this deck match this quiz's card types and tags.</p>
          ) : (
            <ul className="rules">
              {quiz.timeLimit > 0 && <li>The quiz ends when the clock reaches 0:00.</li>}
              {quiz.perQuestion > 0 && <li>Each question has {quiz.perQuestion} seconds; after that it counts as missed.</li>}
              <li>Questions you don't answer count as wrong.</li>
            </ul>
          )}
          {best && (
            <p className="sub">
              Best: {best.correct} / {best.total} ({percent(best.correct, best.total)}%) · {history.length} attempt
              {history.length === 1 ? '' : 's'}
            </p>
          )}
          <div className="row">
            <button type="button" className="primary" autoFocus disabled={available === 0} onClick={start}>
              Start
            </button>
            <button type="button" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && item && (
        <>
          {questionLeft !== null && (
            <div className={`question-clock ${low(questionLeft, quiz.perQuestion) ? 'low' : ''}`}>
              <div style={{ width: `${Math.max(0, questionLeft / quiz.perQuestion) * 100}%` }} />
              <span>{Math.max(0, Math.ceil(questionLeft))} s</span>
            </div>
          )}
          <CardView
            key={`${run}-${pos}`}
            card={item.card}
            label={item.variant ? VARIANT_LABELS[item.variant] : undefined}
            lang={deck.language.target}
            onAnswer={answer}
            autoPlay
          />
          <div className="next-row">
            {!result && (
              <button type="button" className="ghost" onClick={() => goTo(pos + 1, outcomes)}>
                Skip
              </button>
            )}
            {result && (
              <button type="button" className="primary" autoFocus onClick={() => goTo(pos + 1, outcomes)}>
                {pos + 1 >= queue.length ? 'Finish' : 'Next'} <kbd>Enter</kbd>
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="quiz-results">
          <div className="empty">
            <h2>{timeUp ? "Time's up!" : 'Quiz finished'}</h2>
            <p className="score">
              {correct} / {queue.length} correct · {percent(correct, queue.length)}%
            </p>
            <p className="sub">Time: {formatTime((endedAt - startedAt) / 1000)}</p>
            <div className="row">
              <button type="button" className="primary" onClick={start}>
                Try again
              </button>
              <button type="button" onClick={onExit}>
                Back to deck
              </button>
            </div>
          </div>
          <ol className="result-list">
            {queue.map((it, i) => (
              <li key={it.key + i} className={`outcome-${outcomes[i]}`}>
                <span className="outcome" title={OUTCOME_TEXT[outcomes[i]]} aria-label={OUTCOME_TEXT[outcomes[i]]}>
                  {OUTCOME_ICON[outcomes[i]]}
                </span>
                <span className="badge">{it.variant ? VARIANT_LABELS[it.variant] : CARD_TYPE_LABELS[it.card.type]}</span>
                <span className="summary">{cardSummary(it.card)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

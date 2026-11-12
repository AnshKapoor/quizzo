// Small SM-2 style scheduler. Every card type reports a Grade; quiz-style cards map
// correct -> 'good' and wrong -> 'again', flashcards let the learner pick.
import type { CardProgress, Grade } from '../types';

export const DAY = 24 * 60 * 60 * 1000;
const RELEARN_DELAY = 10 * 60 * 1000;

export function schedule(prev: CardProgress | undefined, grade: Grade, now = Date.now()): CardProgress {
  const p: CardProgress = prev ?? { reps: 0, lapses: 0, ease: 2.5, interval: 0, due: now, last: 0 };

  if (grade === 'again') {
    return {
      reps: 0,
      lapses: p.reps > 0 ? p.lapses + 1 : p.lapses,
      ease: Math.max(1.3, p.ease - 0.2),
      interval: 0,
      due: now + RELEARN_DELAY,
      last: now,
    };
  }

  const q = grade === 'hard' ? 3 : grade === 'good' ? 4 : 5;
  const ease = Math.max(1.3, p.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let interval: number;
  if (p.reps === 0) interval = grade === 'easy' ? 3 : 1;
  else if (p.reps === 1) interval = grade === 'hard' ? 3 : grade === 'good' ? 6 : 8;
  else {
    const factor = grade === 'hard' ? 1.2 : grade === 'good' ? ease : ease * 1.3;
    interval = Math.max(p.interval + 1, Math.round(p.interval * factor));
  }

  return { reps: p.reps + 1, lapses: p.lapses, ease, interval, due: now + interval * DAY, last: now };
}

export const isDue = (p: CardProgress | undefined, now = Date.now()) => !!p && p.due <= now;

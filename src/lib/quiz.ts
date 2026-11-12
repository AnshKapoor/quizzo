// Timed quizzes: picking the questions, keeping results, and formatting times.
import type { Deck, Library, QuizAttempt, QuizPreset, StudyItem } from '../types';
import { spreadOut } from './library';
import { shuffle, uid } from './util';
import { expandDeck } from './vocab';

export function newQuizPreset(): QuizPreset {
  return { id: uid('q-'), title: 'Test', questions: 10, timeLimit: 10 * 60, perQuestion: 0 };
}

/** All questions a quiz can draw from, after its type and tag filters. */
export function quizPool(deck: Deck, quiz: QuizPreset): StudyItem[] {
  const byId = new Map(deck.cards.map((c) => [c.id, c]));
  return expandDeck(deck).filter((it) => {
    const source = byId.get(it.sourceId);
    if (!source) return false;
    if (quiz.types?.length && !quiz.types.includes(source.type)) return false;
    if (quiz.tags?.length && !source.tags?.some((t) => quiz.tags!.includes(t))) return false;
    return true;
  });
}

/** A random selection of questions for one run of the quiz. */
export function buildQuizQueue(deck: Deck, quiz: QuizPreset): StudyItem[] {
  const pool = shuffle(quizPool(deck, quiz));
  return spreadOut(quiz.questions > 0 ? pool.slice(0, quiz.questions) : pool);
}

const MAX_ATTEMPTS_PER_QUIZ = 20;

export function addAttempt(lib: Library, attempt: QuizAttempt): Library {
  const all = [...(lib.attempts ?? []), attempt];
  const same = (a: QuizAttempt) => a.deckId === attempt.deckId && a.quizId === attempt.quizId;
  const extra = all.filter(same).length - MAX_ATTEMPTS_PER_QUIZ;
  let dropped = 0;
  return { ...lib, attempts: all.filter((a) => !(same(a) && dropped++ < extra)) };
}

export function quizAttempts(lib: Library, deckId: string, quizId: string): QuizAttempt[] {
  return (lib.attempts ?? []).filter((a) => a.deckId === deckId && a.quizId === quizId);
}

export const percent = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0);

/** 75 → "1:15", 3600 → "60:00". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "10 questions · 10 min · 30 s each" */
export function quizSummary(quiz: QuizPreset, available: number): string {
  const n = quiz.questions > 0 ? Math.min(quiz.questions, available) : available;
  const parts = [`${n} question${n === 1 ? '' : 's'}`];
  if (quiz.timeLimit) parts.push(quiz.timeLimit % 60 ? formatTime(quiz.timeLimit) : `${quiz.timeLimit / 60} min`);
  if (quiz.perQuestion) parts.push(`${quiz.perQuestion} s each`);
  if (!quiz.timeLimit && !quiz.perQuestion) parts.push('no time limit');
  return parts.join(' · ');
}

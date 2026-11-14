// Timed quizzes: picking the questions, keeping results, and formatting times.
import type { Card, CustomQuiz, Deck, Library, QuizAttempt, QuizPreset, StudyItem } from '../types';
import { spreadOut } from './library';
import { shuffle, uid } from './util';
import { expandCard, expandDeck } from './vocab';

/** `deckId` used for the results of custom (multi-deck) quizzes. */
export const CUSTOM_QUIZ_OWNER = '@custom';

/** A question in a quiz, with the deck it came from (for progress and read-aloud language). */
export interface QuizItem extends StudyItem {
  deckId: string;
  lang: string;
}

/** Seconds per question when a card doesn't set its own time and Settings haven't changed it. */
export const DEFAULT_QUESTION_TIME = 30;

/** The default time per question from Settings. */
export function defaultQuestionTime(lib: Library): number {
  const t = lib.settings?.questionTime;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.round(t) : DEFAULT_QUESTION_TIME;
}

/** Seconds the question gets in this quiz; 0 = no limit. */
export function questionLimit(quiz: QuizPreset, item: StudyItem, defaultTime: number): number {
  if (quiz.cardTimes) return item.card.time && item.card.time > 0 ? item.card.time : defaultTime;
  return quiz.perQuestion;
}

// New quizzes give every question its card's own time.
export function newQuizPreset(): QuizPreset {
  return { id: uid('q-'), title: 'Test', questions: 10, timeLimit: 0, perQuestion: 0, cardTimes: true };
}

export function newCustomQuiz(): CustomQuiz {
  return { id: uid('cq-'), title: 'My quiz', questions: 0, timeLimit: 0, perQuestion: 0, cardTimes: true, picks: [] };
}

/** All questions a deck quiz can draw from, after its type and tag filters. */
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

export function deckQuizItems(deck: Deck, quiz: QuizPreset): QuizItem[] {
  return quizPool(deck, quiz).map((it) => ({ ...it, deckId: deck.id, lang: deck.language.target }));
}

/** The picked cards that still exist, in the order they were picked. */
export function resolvePicks(lib: Library, quiz: CustomQuiz): { deck: Deck; card: Card }[] {
  const decks = new Map(lib.decks.map((d) => [d.id, d]));
  return quiz.picks.flatMap(({ deckId, cardId }) => {
    const deck = decks.get(deckId);
    const card = deck?.cards.find((c) => c.id === cardId);
    return deck && card ? [{ deck, card }] : [];
  });
}

/** Every question of the picked cards (a vocabulary entry gives several). */
export function customQuizItems(lib: Library, quiz: CustomQuiz): QuizItem[] {
  return resolvePicks(lib, quiz).flatMap(({ deck, card }) =>
    expandCard(card, deck).map((it) => ({ ...it, deckId: deck.id, lang: deck.language.target })),
  );
}

/** A random selection of questions for one run of the quiz. */
export function buildQuizQueue<T extends StudyItem>(pool: T[], quiz: QuizPreset): T[] {
  const picked = shuffle(pool);
  return spreadOut(quiz.questions > 0 ? picked.slice(0, quiz.questions) : picked) as T[];
}

/**
 * Turns a custom quiz into a normal deck (copies of the picked cards plus the quiz settings),
 * so it can be exported and shared like any other deck.
 */
export function customQuizToDeck(lib: Library, quiz: CustomQuiz, id = uid('deck-')): Deck {
  const picked = resolvePicks(lib, quiz);
  const used = new Set<string>();
  const cards = picked.map(({ card }) => {
    let cid = card.id;
    for (let n = 2; used.has(cid); n++) cid = `${card.id}-${n}`;
    used.add(cid);
    return { ...card, id: cid };
  });
  const { picks: _picks, ...preset } = quiz;
  return {
    id,
    title: quiz.title,
    description: `Questions from ${new Set(picked.map((p) => p.deck.title)).size} deck(s).`,
    language: picked[0]?.deck.language ?? { target: 'de', native: 'en' },
    cards,
    quizzes: [{ ...preset, id: 'q-' + quiz.id }],
  };
}

export function upsertCustomQuiz(lib: Library, quiz: CustomQuiz): Library {
  const list = lib.customQuizzes ?? [];
  const exists = list.some((q) => q.id === quiz.id);
  return { ...lib, customQuizzes: exists ? list.map((q) => (q.id === quiz.id ? quiz : q)) : [...list, quiz] };
}

export function removeCustomQuiz(lib: Library, quizId: string): Library {
  return {
    ...lib,
    customQuizzes: (lib.customQuizzes ?? []).filter((q) => q.id !== quizId),
    attempts: lib.attempts?.filter((a) => !(a.deckId === CUSTOM_QUIZ_OWNER && a.quizId === quizId)),
  };
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
  if (quiz.cardTimes) parts.push('time per card');
  else if (quiz.perQuestion) parts.push(`${quiz.perQuestion} s each`);
  if (!quiz.timeLimit && !quiz.perQuestion && !quiz.cardTimes) parts.push('no time limit');
  return parts.join(' · ');
}

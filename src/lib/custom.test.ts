import { describe, expect, it } from 'vitest';
import type { CustomQuiz, Deck, Library } from '../types';
import {
  addAttempt,
  buildQuizQueue,
  CUSTOM_QUIZ_OWNER,
  customQuizItems,
  customQuizToDeck,
  quizAttempts,
  removeCustomQuiz,
  upsertCustomQuiz,
} from './quiz';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearance';
import { emptyLibrary } from './storage';
import { validateDeck } from './validate';

const deckA: Deck = {
  id: 'a',
  title: 'A',
  language: { target: 'de', native: 'en' },
  cards: [
    { id: 'c1', type: 'flashcard', front: 'Hund', back: 'dog' },
    { id: 'v1', type: 'vocab', word: 'Tisch', article: 'der', plural: 'Tische', meaning: 'table' },
  ],
};
const deckB: Deck = {
  id: 'b',
  title: 'B',
  language: { target: 'fr', native: 'en' },
  cards: [{ id: 'c1', type: 'flashcard', front: 'chien', back: 'dog' }],
};
const lib: Library = { ...emptyLibrary(), decks: [deckA, deckB] };
const quiz = (picks: CustomQuiz['picks'], questions = 0): CustomQuiz => ({
  id: 'cq',
  title: 'Mix',
  questions,
  timeLimit: 60,
  perQuestion: 0,
  picks,
});

describe('custom quizzes', () => {
  it('draw questions from several decks and keep each deck and language', () => {
    const items = customQuizItems(lib, quiz([{ deckId: 'a', cardId: 'c1' }, { deckId: 'b', cardId: 'c1' }]));
    expect(items.map((i) => [i.deckId, i.lang, i.key])).toEqual([
      ['a', 'de', 'c1'],
      ['b', 'fr', 'c1'],
    ]);
  });

  it('expand vocabulary into its questions and skip deleted cards', () => {
    const items = customQuizItems(lib, quiz([{ deckId: 'a', cardId: 'v1' }, { deckId: 'a', cardId: 'gone' }, { deckId: 'x', cardId: 'c1' }]));
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.every((i) => i.sourceId === 'v1')).toBe(true);
  });

  it('limit the number of questions per run', () => {
    const q = quiz([{ deckId: 'a', cardId: 'v1' }, { deckId: 'a', cardId: 'c1' }, { deckId: 'b', cardId: 'c1' }], 2);
    expect(buildQuizQueue(customQuizItems(lib, q), q)).toHaveLength(2);
  });

  it('export as a valid deck with unique card ids', () => {
    const q = quiz([{ deckId: 'a', cardId: 'c1' }, { deckId: 'b', cardId: 'c1' }]);
    const deck = customQuizToDeck(lib, q, 'exp');
    expect(deck.cards.map((c) => c.id)).toEqual(['c1', 'c1-2']);
    expect(deck.quizzes?.[0]).not.toHaveProperty('picks');
    const { deck: valid, errors } = validateDeck(deck);
    expect(errors).toEqual([]);
    expect(valid?.cards).toHaveLength(2);
  });

  it('save, replace and delete with their results', () => {
    let l = upsertCustomQuiz(lib, quiz([]));
    l = upsertCustomQuiz(l, { ...quiz([]), title: 'Renamed' });
    expect(l.customQuizzes?.map((q) => q.title)).toEqual(['Renamed']);
    l = addAttempt(l, { deckId: CUSTOM_QUIZ_OWNER, quizId: 'cq', at: 1, correct: 1, total: 2, seconds: 5 });
    expect(quizAttempts(l, CUSTOM_QUIZ_OWNER, 'cq')).toHaveLength(1);
    l = removeCustomQuiz(l, 'cq');
    expect(l.customQuizzes).toEqual([]);
    expect(quizAttempts(l, CUSTOM_QUIZ_OWNER, 'cq')).toHaveLength(0);
  });
});

describe('appearance', () => {
  it('fills in defaults and drops unknown values', () => {
    expect(normalizeAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({ theme: 'sepia', size: 'huge', layout: 'left' })).toEqual({
      ...DEFAULT_APPEARANCE,
      theme: 'sepia',
      layout: 'left',
    });
  });
});

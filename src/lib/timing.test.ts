import { describe, expect, it } from 'vitest';
import type { Deck, Library, QuizPreset, VocabCard } from '../types';
import { cardToForm, emptyForm, formToCard } from './cardForm';
import { DEFAULT_QUESTION_TIME, defaultQuestionTime, newQuizPreset, questionLimit, quizSummary } from './quiz';
import { emptyLibrary } from './storage';
import { parseImport, validateCard } from './validate';
import { expandCard } from './vocab';

const preset = (p: Partial<QuizPreset> = {}): QuizPreset => ({
  id: 'q', title: 'T', questions: 0, timeLimit: 0, perQuestion: 0, ...p,
});
const item = (time?: number) => ({
  key: 'c', sourceId: 'c', card: { id: 'c', type: 'flashcard' as const, front: 'a', back: 'b', ...(time ? { time } : {}) },
});

describe('per-card quiz times', () => {
  it('new quizzes are timed per card', () => {
    expect(newQuizPreset().cardTimes).toBe(true);
    expect(quizSummary(newQuizPreset(), 4)).toBe('4 questions · time per card');
  });

  it('uses the card time, else the default; fixed and untimed quizzes ignore card times', () => {
    expect(questionLimit(preset({ cardTimes: true }), item(45), 30)).toBe(45);
    expect(questionLimit(preset({ cardTimes: true }), item(), 30)).toBe(30);
    expect(questionLimit(preset({ perQuestion: 20 }), item(45), 30)).toBe(20);
    expect(questionLimit(preset(), item(45), 30)).toBe(0);
  });

  it('default comes from settings, falling back to 30 s', () => {
    const lib: Library = emptyLibrary();
    expect(defaultQuestionTime(lib)).toBe(DEFAULT_QUESTION_TIME);
    expect(defaultQuestionTime({ ...lib, settings: { questionTime: 50 } })).toBe(50);
    expect(defaultQuestionTime({ ...lib, settings: { questionTime: -3 } })).toBe(30);
  });

  it('card editor reads and writes the time; empty means default', () => {
    const f = { ...emptyForm('flashcard'), front: 'der Hund', back: 'the dog' };
    expect(formToCard(f, 'c1').card).not.toHaveProperty('time');
    const timed = formToCard({ ...f, time: '45' }, 'c1').card!;
    expect(timed.time).toBe(45);
    expect(cardToForm(timed).time).toBe('45');
    expect(formToCard({ ...f, time: 'abc' }, 'c1').error).toMatch(/seconds/);
    expect(formToCard({ ...f, time: '0' }, 'c1').error).toMatch(/seconds/);
  });

  it('validation rejects bad times and keeps cardTimes on quizzes', () => {
    expect(validateCard({ type: 'flashcard', front: 'a', back: 'b', time: -1 })).toMatch(/time/);
    expect(validateCard({ type: 'flashcard', front: 'a', back: 'b', time: 20 })).toBeNull();
    const { decks } = parseImport(
      JSON.stringify({ title: 'D', cards: [], quizzes: [{ title: 'Q', cardTimes: true }, { title: 'R', cardTimes: 'yes' }] }),
    );
    expect(decks[0].quizzes?.map((q) => q.cardTimes)).toEqual([true, undefined]);
  });

  it('vocabulary questions inherit the entry time', () => {
    const v: VocabCard = { id: 'v', type: 'vocab', word: 'Tisch', article: 'der', meaning: 'table', time: 15 };
    const deck: Deck = { id: 'd', title: 'D', language: { target: 'de', native: 'en' }, cards: [v] };
    expect(expandCard(v, deck).every((it) => it.card.time === 15)).toBe(true);
  });
});

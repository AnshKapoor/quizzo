import { describe, expect, it } from 'vitest';
import type { Deck, Library, QuizPreset } from '../types';
import { cardToForm, formToCard } from './cardForm';
import { addAttempt, buildQuizQueue, formatTime, quizAttempts, quizPool, quizSummary } from './quiz';
import { removeDeck } from './library';
import { moveItem } from './util';
import { parseImport, validateCard } from './validate';
import practice from '../data/german-a1-practice.quizzo.json';

const deck = (practice as any).deck as Deck;
const preset = (p: Partial<QuizPreset> = {}): QuizPreset => ({
  id: 'q', title: 'T', questions: 10, timeLimit: 300, perQuestion: 0, ...p,
});

describe('sequence cards', () => {
  it('need at least two items', () => {
    expect(validateCard({ type: 'sequence', items: ['eins'] })).toMatch(/2/);
    expect(validateCard({ type: 'sequence', items: ['eins', 'zwei'] })).toBeNull();
  });
  it('round-trip through the editor form', () => {
    const card = deck.cards.find((c) => c.id === 'seq-cafe')!;
    expect(formToCard(cardToForm(card), card.id).card).toEqual(card);
  });
  it('moveItem moves one element', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('table cards', () => {
  it('need every row to fill every column', () => {
    const base = { type: 'table', columns: ['', 'sein'], rows: [['ich', 'bin']] };
    expect(validateCard(base)).toBeNull();
    expect(validateCard({ ...base, rows: [['ich']] })).toMatch(/row 1/);
    expect(validateCard({ ...base, rows: [['ich', ' ']] })).toMatch(/row 1/);
    expect(validateCard({ ...base, columns: ['sein'] })).toMatch(/columns/);
  });
  it('round-trip through the editor form, including an empty corner header', () => {
    const card = deck.cards.find((c) => c.id === 'tab-sein-haben')!;
    expect(formToCard(cardToForm(card), card.id).card).toEqual(card);
  });
});

describe('timed quizzes', () => {
  it('are imported with the deck; broken ones are dropped and reported', () => {
    const r = parseImport(JSON.stringify(practice));
    expect(r.errors).toEqual([]);
    expect(r.decks[0].quizzes?.map((q) => q.id)).toEqual(['q-a1-test', 'q-a1-speed']);

    const bad = parseImport(
      JSON.stringify({ title: 'x', cards: [], quizzes: [{ questions: 3 }, { title: 'ok', questions: -2, types: ['mcq', 'nope'] }] }),
    );
    expect(bad.errors).toEqual(['timed quiz #1: needs a "title"']);
    expect(bad.decks[0].quizzes).toEqual([
      { id: expect.any(String), title: 'ok', questions: 0, timeLimit: 0, perQuestion: 0, types: ['mcq'] },
    ]);
  });
  it('draw only matching questions, up to the requested count', () => {
    const verbs = preset({ tags: ['verbs'], questions: 0 });
    const pool = quizPool(deck, verbs);
    expect(pool.length).toBeGreaterThan(0);
    expect(buildQuizQueue(deck, verbs).length).toBe(pool.length);
    expect(buildQuizQueue(deck, preset({ questions: 4 })).length).toBe(4);
    const tables = quizPool(deck, preset({ types: ['table'] }));
    expect(tables.map((i) => i.key).sort()).toEqual(['tab-artikel', 'tab-sein-haben']);
    // Vocabulary entries count by their source type.
    expect(quizPool(deck, preset({ types: ['vocab'] })).every((i) => i.key.includes('#'))).toBe(true);
  });
  it('keep the last 20 attempts per quiz and drop them with the deck', () => {
    let lib: Library = { format: 'quizzo-library', version: 1, decks: [deck], progress: {} };
    for (let i = 0; i < 25; i++) lib = addAttempt(lib, { deckId: deck.id, quizId: 'q', at: i, correct: i, total: 30, seconds: 60 });
    lib = addAttempt(lib, { deckId: deck.id, quizId: 'other', at: 99, correct: 1, total: 1, seconds: 5 });
    const runs = quizAttempts(lib, deck.id, 'q');
    expect(runs.length).toBe(20);
    expect(runs[0].at).toBe(5);
    expect(removeDeck(lib, deck.id).attempts).toEqual([]);
  });
  it('format times and summaries', () => {
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(0.2)).toBe('0:01');
    expect(formatTime(-3)).toBe('0:00');
    expect(quizSummary(preset({ questions: 10, timeLimit: 300 }), 50)).toBe('10 questions · 5 min');
    expect(quizSummary(preset({ questions: 0, timeLimit: 0, perQuestion: 20 }), 3)).toBe('3 questions · 20 s each');
    expect(quizSummary(preset({ questions: 5, timeLimit: 0 }), 2)).toBe('2 questions · no time limit');
  });
});

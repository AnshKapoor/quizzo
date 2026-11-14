import { describe, expect, it } from 'vitest';
import type { Card, Deck, Library } from '../types';
import { emptyLibrary } from './storage';
import { removeCard, removeDeck, saveCard } from './library';
import { lastChange, mergeLibraries } from './merge';

const card = (id: string, back = 'b', updatedAt?: number): Card => ({
  id, type: 'flashcard', front: id, back, ...(updatedAt ? { updatedAt } : {}),
});
const deck = (id: string, cards: Card[]): Deck => ({ id, title: `Deck ${id}`, language: { target: 'de', native: 'en' }, cards });
const lib = (decks: Deck[], extra: Partial<Library> = {}): Library => ({ ...emptyLibrary(), decks, ...extra });
const ids = (l: Library, d = 'd') => l.decks.find((x) => x.id === d)?.cards.map((c) => c.id);

describe('merging backups', () => {
  it('keeps new cards from both sides without asking', () => {
    const base = [card('c1', 'b', 100)];
    const here = lib([deck('d', [...base, card('mine', 'b', 200)])]);
    const backup = lib([deck('d', [...base, card('theirs', 'b', 300)]), deck('e', [card('x')])]);
    const r = mergeLibraries(here, backup);
    expect(r.conflicts).toEqual([]);
    expect(ids(r.library)).toEqual(['c1', 'mine', 'theirs']);
    expect(ids(r.library, 'e')).toEqual(['x']);
    expect(r.added).toBe(2);
  });

  it('asks about a card changed on both sides, newer by default, and follows the choice', () => {
    const here = lib([deck('d', [card('c1', 'mine', 200)])]);
    const backup = lib([deck('d', [card('c1', 'theirs', 300)])]);
    const r = mergeLibraries(here, backup);
    expect(r.conflicts).toMatchObject([{ id: 'd:c1', kind: 'edited', mineAt: 200, theirsAt: 300 }]);
    expect((r.library.decks[0].cards[0] as any).back).toBe('theirs');
    const kept = mergeLibraries(here, backup, () => 'mine');
    expect((kept.library.decks[0].cards[0] as any).back).toBe('mine');
  });

  it('a deletion wins over an older card, and is asked about when the card was edited later', () => {
    let here = lib([deck('d', [card('c1', 'b', 100), card('c2', 'b', 100)])]);
    here = removeCard(here, 'd', 'c1', 500);
    // Backup: c1 unchanged since (stays deleted), c2 untouched.
    expect(ids(mergeLibraries(here, lib([deck('d', [card('c1', 'b', 100), card('c2', 'b', 100)])])).library)).toEqual(['c2']);
    // Backup: c1 edited after the deletion -> conflict.
    const r = mergeLibraries(here, lib([deck('d', [card('c1', 'new', 900), card('c2', 'b', 100)])]));
    expect(r.conflicts).toMatchObject([{ id: 'd:c1', kind: 'deleted-here', mineAt: 500, theirsAt: 900 }]);
    expect(ids(r.library)).toEqual(['c2', 'c1']); // newer = the edit
  });

  it('applies deletions made on the other device', () => {
    const here = lib([deck('d', [card('c1', 'b', 100), card('c2', 'b', 100)])]);
    const backup = removeCard(lib([deck('d', [card('c1', 'b', 100), card('c2', 'b', 100)])]), 'd', 'c2', 400);
    const r = mergeLibraries(here, backup);
    expect(ids(r.library)).toEqual(['c1']);
    expect(r.removed).toBe(1);
    expect(r.library.deleted?.['d:c2']).toBe(400);
  });

  it('always asks before dropping a whole deck deleted on the other device', () => {
    const here = lib([deck('d', [card('c1')]), deck('e', [card('c2')])]);
    const backup = removeDeck(lib([deck('d', [card('c1')]), deck('e', [card('c2')])]), 'e', 700);
    const r = mergeLibraries(here, backup, () => 'mine');
    expect(r.conflicts).toMatchObject([{ id: 'e', kind: 'deck-deleted-there' }]);
    expect(r.library.decks.map((d) => d.id)).toEqual(['d', 'e']);
    expect(mergeLibraries(here, backup, () => 'theirs').library.decks.map((d) => d.id)).toEqual(['d']);
    // A deck deleted here stays deleted when the backup's copy is older.
    const gone = removeDeck(here, 'e', 900);
    expect(mergeLibraries(gone, lib([deck('d', [card('c1')]), deck('e', [card('c2', 'b', 100)])])).library.decks.map((d) => d.id)).toEqual(['d']);
  });

  it('keeps the latest progress and all quiz results, once', () => {
    const p = (last: number) => ({ reps: last, lapses: 0, ease: 2.5, interval: 1, due: 0, last });
    const a1 = { deckId: 'd', quizId: 'q', at: 1, correct: 1, total: 2, seconds: 5 };
    const a2 = { ...a1, at: 2 };
    const here = lib([deck('d', [card('c1')])], { progress: { 'd:c1': p(5) }, attempts: [a1] });
    const backup = lib([deck('d', [card('c1')])], { progress: { 'd:c1': p(3), 'd:c2': p(1) }, attempts: [a1, a2] });
    const r = mergeLibraries(here, backup).library;
    expect(r.progress['d:c1'].last).toBe(5);
    expect(r.progress['d:c2'].last).toBe(1);
    expect(r.attempts).toEqual([a1, a2]);
  });

  it('saving a card stamps real edits only', () => {
    let l = lib([deck('d', [card('c1', 'b', 100)])]);
    l = saveCard(l, 'd', card('c1', 'b'), 999);
    expect(l.decks[0].cards[0].updatedAt).toBe(100); // unchanged content keeps its time
    l = saveCard(l, 'd', card('c1', 'changed'), 999);
    expect(l.decks[0].cards[0].updatedAt).toBe(999);
    expect(lastChange(removeCard(l, 'd', 'c1', 1500))).toBe(1500);
  });
});

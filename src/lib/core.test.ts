import { describe, expect, it } from 'vitest';
import { checkTyped, sameSentence } from './answer';
import { clozeSolution, parseCloze } from './cloze';
import { formToCard, cardToForm } from './cardForm';
import { schedule, DAY } from './srs';
import { parseImport } from './validate';
import starter from '../data/german-a1-starter.quizzo.json';
import practice from '../data/german-a1-practice.quizzo.json';

describe('answer checking', () => {
  it('accepts exact answers, ignoring spacing and trailing punctuation', () => {
    expect(checkTyped('  heiße. ', ['heiße'])).toBe('exact');
  });
  it('accepts ae/oe/ue/ss spellings but flags them', () => {
    expect(checkTyped('heisse', ['heiße'])).toBe('umlaut');
    expect(checkTyped('fuenf', ['fünf'])).toBe('umlaut');
  });
  it('flags capitalisation when case-sensitive', () => {
    expect(checkTyped('kaffee', ['Kaffee'], true)).toBe('case');
    expect(checkTyped('kaffee', ['Kaffee'], false)).toBe('exact');
  });
  it('rejects wrong answers and blanks', () => {
    expect(checkTyped('Tee', ['Kaffee'])).toBe('wrong');
    expect(checkTyped('  ', ['Kaffee'])).toBe('wrong');
  });
  it('compares sentences ignoring case and punctuation', () => {
    expect(sameSentence('ich fahre Morgen nach Berlin.', 'Ich fahre morgen nach Berlin')).toBe(true);
  });
});

describe('cloze', () => {
  it('parses blanks, alternatives and hints', () => {
    const s = parseCloze('Das ist {{schön|gut::adj}}, {{ja}}.');
    expect(s.filter((x) => x.kind === 'blank')).toEqual([
      { kind: 'blank', index: 0, answers: ['schön', 'gut'], hint: 'adj' },
      { kind: 'blank', index: 1, answers: ['ja'], hint: undefined },
    ]);
    expect(clozeSolution('Das ist {{schön|gut::adj}}.')).toBe('Das ist schön.');
  });
});

describe('scheduler', () => {
  it('grows intervals on success and resets on failure', () => {
    const now = 0;
    const a = schedule(undefined, 'good', now);
    expect(a.interval).toBe(1);
    const b = schedule(a, 'good', now);
    expect(b.interval).toBe(6);
    const c = schedule(b, 'good', now);
    expect(c.interval).toBeGreaterThan(6);
    const d = schedule(c, 'again', now);
    expect(d.interval).toBe(0);
    expect(d.lapses).toBe(1);
    expect(d.due).toBeLessThan(DAY);
  });
});

describe('card form round trip', () => {
  it('keeps every built-in card intact through the editor', () => {
    for (const card of [...(starter as any).deck.cards, ...(practice as any).deck.cards]) {
      const { card: back, error } = formToCard(cardToForm(card), card.id);
      expect(error).toBeUndefined();
      expect(back).toEqual(card);
    }
  });
});

describe('import', () => {
  it('loads the starter deck without errors', () => {
    const r = parseImport(JSON.stringify(starter));
    expect(r.errors).toEqual([]);
    expect(r.decks[0].cards.length).toBeGreaterThan(20);
  });
  it('accepts a bare deck, reports bad cards and keeps good ones', () => {
    const r = parseImport(
      JSON.stringify({
        title: 'T',
        cards: [
          { type: 'flashcard', front: 'a', back: 'b' },
          { type: 'mcq', prompt: 'q', options: ['x'], answer: [0] },
          { type: 'teleport' },
        ],
      }),
    );
    expect(r.decks[0].cards).toHaveLength(1);
    expect(r.decks[0].cards[0].id).toBeTruthy();
    expect(r.errors).toHaveLength(2);
  });
  it('rejects invalid JSON', () => {
    expect(parseImport('{nope').errors[0]).toMatch(/Not valid JSON/);
  });
});

import { describe, expect, it } from 'vitest';
import { CARD_TYPE_LABELS, cardToForm, formToCard } from './cardForm';
import { CARD_HELP, exampleDeck } from './help';
import { parseImport, validateCard } from './validate';

describe('help', () => {
  it('covers every card type', () => {
    expect(Object.keys(CARD_HELP).sort()).toEqual(Object.keys(CARD_TYPE_LABELS).sort());
  });
  it.each(Object.entries(CARD_HELP))('the %s example is valid and survives the editor', (type, h) => {
    expect(h.example.type).toBe(type);
    expect(validateCard(h.example)).toBeNull();
    expect(formToCard(cardToForm(h.example), h.example.id).card).toEqual(h.example);
  });
  it('the example deck imports without problems', () => {
    const r = parseImport(JSON.stringify(exampleDeck('deck-x')));
    expect(r.errors).toEqual([]);
    expect(r.decks[0].cards.length).toBe(Object.keys(CARD_HELP).length);
    expect(r.decks[0].quizzes?.length).toBe(1);
  });
});

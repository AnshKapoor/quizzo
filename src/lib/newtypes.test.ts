import { describe, expect, it } from 'vitest';
import type { Deck, Library, VocabCard } from '../types';
import { compareWords, dictationCorrect } from './diff';
import { buildQueue, recordAnswer, removeCard, spreadOut } from './library';
import { correctedSentence, parseSpot } from './spot';
import { addBuiltinDecks, BUILTIN_IDS, starterLibrary } from './storage';
import { parseImport, validateCard } from './validate';
import { expandDeck, expandVocab } from './vocab';
import practice from '../data/german-a1-practice.quizzo.json';

describe('find the mistake', () => {
  it('parses marked mistakes and builds the corrected sentence', () => {
    const t = parseSpot('Ich [[kommen|komme]] aus [[der|den]] USA.');
    expect(t.map((x) => x.text)).toEqual(['Ich', 'kommen', 'aus', 'der', 'USA.']);
    expect(t.filter((x) => x.correction).map((x) => x.correction)).toEqual(['komme', 'den']);
    expect(correctedSentence(t)).toBe('Ich komme aus den USA.');
  });
  it('requires at least one mistake', () => {
    expect(validateCard({ type: 'spot', text: 'Alles ist richtig.' })).toMatch(/mistake/);
  });
});

describe('dictation', () => {
  const s = 'Das Wetter ist heute schön.';
  it('ignores case and punctuation, accepts oe for ö', () => {
    expect(dictationCorrect(s, 'das wetter ist heute schoen')).toBe(true);
    expect(compareWords(s, 'das wetter ist heute schoen').at(-1)?.status).toBe('umlaut');
  });
  it('marks missing and wrong words', () => {
    const r = compareWords(s, 'Das Wetter heute schon');
    expect(r.filter((w) => w.status === 'missed').map((w) => w.word)).toEqual(['ist', 'schön']);
    expect(dictationCorrect(s, 'Das Wetter ist heute schön sehr')).toBe(false); // extra word
  });
});

describe('vocabulary entries', () => {
  const deck = (practice as any).deck as Deck;
  const tisch = deck.cards.find((c) => c.id === 'v-tisch') as VocabCard;

  it('generates read, write, article, plural and meaning questions', () => {
    const items = expandVocab(tisch, deck);
    expect(items.map((i) => i.variant)).toEqual(['read', 'write', 'article', 'plural', 'meaning']);
    expect(items.every((i) => i.key.startsWith('v-tisch#') && validateCard(i.card) === null)).toBe(true);
    const meaning = items.find((i) => i.variant === 'meaning')!.card as any;
    expect(meaning.options[0]).toBe('table');
    expect(new Set(meaning.options).size).toBe(4);
  });
  it('is stable between calls (no reshuffled options)', () => {
    expect(expandVocab(tisch, deck)).toEqual(expandVocab(tisch, deck));
  });
  it('skips article/plural questions for verbs', () => {
    const lesen = deck.cards.find((c) => c.id === 'v-lesen') as VocabCard;
    expect(expandVocab(lesen, deck).map((i) => i.variant)).toEqual(['read', 'write', 'meaning']);
  });
  it('tracks progress per generated question and cleans it up on delete', () => {
    let lib: Library = { format: 'quizzo-library', version: 1, decks: [deck], progress: {} };
    lib = recordAnswer(lib, deck.id, 'v-tisch#article', 'good');
    lib = recordAnswer(lib, deck.id, 'v-tisch#read', 'good');
    lib = recordAnswer(lib, deck.id, 'v-tischler', 'good'); // different card with a similar id
    lib = removeCard(lib, deck.id, 'v-tisch');
    expect(Object.keys(lib.progress)).toEqual([`${deck.id}:v-tischler`]);
  });
  it('builds a review queue from questions and avoids back-to-back siblings', () => {
    const lib: Library = { format: 'quizzo-library', version: 1, decks: [deck], progress: {} };
    const q = buildQueue(deck, lib, 'review');
    expect(q.length).toBe(10);
    const spread = spreadOut(expandDeck(deck));
    const adjacent = spread.filter((it, i) => i > 0 && spread[i - 1].sourceId === it.sourceId).length;
    expect(adjacent).toBeLessThan(3);
  });
});

describe('practice deck', () => {
  it('imports without errors', () => {
    const r = parseImport(JSON.stringify(practice));
    expect(r.errors).toEqual([]);
  });
});

describe('built-in decks', () => {
  it('a fresh library gets all built-in decks', () => {
    expect(starterLibrary().decks.map((d) => d.id)).toEqual(BUILTIN_IDS);
  });
  it('an older library gets new built-ins once; deleted ones stay deleted', () => {
    const old: Library = { ...starterLibrary(), seeded: undefined };
    old.decks = old.decks.filter((d) => d.id === BUILTIN_IDS[0]);
    const upgraded = addBuiltinDecks(old);
    expect(upgraded.decks.map((d) => d.id)).toEqual(BUILTIN_IDS);
    const afterDelete = { ...upgraded, decks: upgraded.decks.filter((d) => d.id !== BUILTIN_IDS[1]) };
    expect(addBuiltinDecks(afterDelete).decks.map((d) => d.id)).toEqual([BUILTIN_IDS[0]]);
  });
});

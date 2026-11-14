// Pure helpers that return an updated copy of the library.
import type { Card, Deck, Grade, Library, StudyItem } from '../types';
import { isDue, schedule } from './srs';
import { shuffle, uid } from './util';
import { expandCard, expandDeck } from './vocab';

/** `itemKey` is a card id, or `cardId#variant` for questions generated from vocabulary. */
export const progressKey = (deckId: string, itemKey: string) => `${deckId}:${itemKey}`;

export function upsertDeck(lib: Library, deck: Deck): Library {
  const exists = lib.decks.some((d) => d.id === deck.id);
  return { ...lib, decks: exists ? lib.decks.map((d) => (d.id === deck.id ? deck : d)) : [...lib.decks, deck] };
}

const dropProgress = (lib: Library, match: (key: string) => boolean) =>
  Object.fromEntries(Object.entries(lib.progress).filter(([k]) => !match(k)));

/** Remembers when something was deleted, so merging an older backup doesn't bring it back. */
const tombstone = (lib: Library, key: string, now: number) => ({ ...lib.deleted, [key]: now });

export function removeDeck(lib: Library, deckId: string, now = Date.now()): Library {
  return {
    ...lib,
    deleted: tombstone(lib, deckId, now),
    decks: lib.decks.filter((d) => d.id !== deckId),
    progress: dropProgress(lib, (k) => k.startsWith(deckId + ':')),
    attempts: lib.attempts?.filter((a) => a.deckId !== deckId),
  };
}

export function resetDeckProgress(lib: Library, deckId: string): Library {
  return {
    ...lib,
    progress: dropProgress(lib, (k) => k.startsWith(deckId + ':')),
    attempts: lib.attempts?.filter((a) => a.deckId !== deckId),
  };
}

export function saveCard(lib: Library, deckId: string, card: Card, now = Date.now()): Library {
  const old = lib.decks.find((d) => d.id === deckId)?.cards.find((c) => c.id === card.id);
  const { updatedAt: _a, ...a } = (old ?? {}) as Card;
  const { updatedAt: _b, ...b } = card;
  // Only a real change counts as an edit (saving an unchanged card keeps its time).
  if (old && JSON.stringify(a) === JSON.stringify(b)) card = { ...card, updatedAt: old.updatedAt };
  else card = { ...card, updatedAt: now };
  return {
    ...lib,
    decks: lib.decks.map((d) => {
      if (d.id !== deckId) return d;
      const exists = d.cards.some((c) => c.id === card.id);
      return { ...d, cards: exists ? d.cards.map((c) => (c.id === card.id ? card : c)) : [...d.cards, card] };
    }),
  };
}

export function removeCard(lib: Library, deckId: string, cardId: string, now = Date.now()): Library {
  const key = progressKey(deckId, cardId);
  return {
    ...lib,
    deleted: tombstone(lib, key, now),
    progress: dropProgress(lib, (k) => k === key || k.startsWith(key + '#')),
    decks: lib.decks.map((d) => (d.id === deckId ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) } : d)),
  };
}

export function recordAnswer(lib: Library, deckId: string, itemKey: string, grade: Grade, now = Date.now()): Library {
  const key = progressKey(deckId, itemKey);
  return { ...lib, progress: { ...lib.progress, [key]: schedule(lib.progress[key], grade, now) } };
}

/** Adds imported decks. `replace` decides, per clashing id, whether to overwrite or import a copy. */
export function addImportedDecks(lib: Library, decks: Deck[], replace: (d: Deck) => boolean): Library {
  let next = lib;
  for (const d of decks) {
    if (next.decks.some((x) => x.id === d.id) && !replace(d)) {
      next = upsertDeck(next, { ...d, id: uid('deck-'), title: `${d.title} (copy)` });
    } else {
      next = upsertDeck(next, d);
    }
  }
  return next;
}

/** Counts questions (a vocabulary entry produces several), not cards. */
export function deckStats(deck: Deck, lib: Library, now = Date.now()) {
  let due = 0;
  let fresh = 0;
  const items = expandDeck(deck);
  for (const it of items) {
    const p = lib.progress[progressKey(deck.id, it.key)];
    if (!p) fresh++;
    else if (isDue(p, now)) due++;
  }
  return { total: deck.cards.length, questions: items.length, due, fresh };
}

/** Earliest due time over a card's questions; undefined while none has been studied. */
export function cardDue(deck: Deck, lib: Library, card: Card): number | undefined {
  const dues = expandCard(card, deck)
    .map((it) => lib.progress[progressKey(deck.id, it.key)]?.due)
    .filter((d): d is number => d !== undefined);
  return dues.length ? Math.min(...dues) : undefined;
}

export const NEW_PER_SESSION = 10;
export const QUIZ_SIZE = 10;

/**
 * Review = due questions (oldest first) + a few new ones. Quiz = random sample, ignoring the schedule.
 * New questions from the same vocabulary entry are spread out rather than shown back to back.
 */
export function buildQueue(deck: Deck, lib: Library, mode: 'review' | 'quiz', now = Date.now()): StudyItem[] {
  const items = expandDeck(deck);
  if (mode === 'quiz') return spreadOut(shuffle(items).slice(0, QUIZ_SIZE));
  const prog = (it: StudyItem) => lib.progress[progressKey(deck.id, it.key)];
  const due = items.filter((it) => isDue(prog(it), now)).sort((a, b) => prog(a)!.due - prog(b)!.due);
  const fresh = shuffle(items.filter((it) => !prog(it))).slice(0, NEW_PER_SESSION);
  return [...due, ...spreadOut(fresh)];
}

/** Reorders so that two questions from the same card are not next to each other where possible. */
export function spreadOut(items: StudyItem[]): StudyItem[] {
  const rest = items.slice();
  const out: StudyItem[] = [];
  while (rest.length) {
    const prev = out[out.length - 1]?.sourceId;
    const i = rest.findIndex((it) => it.sourceId !== prev);
    out.push(...rest.splice(i === -1 ? 0 : i, 1));
  }
  return out;
}

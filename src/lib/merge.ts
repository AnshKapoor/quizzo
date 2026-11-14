// Merging a backup into this device's library, card by card.
//
// Cards that exist on only one side are kept. A deletion (remembered in `deleted`) wins over a card that
// wasn't edited after it. Everything else that differs is a conflict, and the learner decides which side
// wins (by default the newer one).
import type { Card, CustomQuiz, Deck, Library, QuizAttempt } from '../types';
import { cardSummary } from './cardForm';

export type Side = 'mine' | 'theirs';

export interface Conflict {
  /** `deckId:cardId`, or `deckId` for a whole deck. */
  id: string;
  deckTitle: string;
  /**
   * edited = the card differs on both sides; deleted-here / deleted-there = removed on one side but
   * edited on the other after that; deck-deleted-there = the whole deck was removed on the other device.
   */
  kind: 'edited' | 'deleted-here' | 'deleted-there' | 'deck-deleted-there';
  /** What each side has (undefined = deleted there). */
  mine?: string;
  theirs?: string;
  /** When each side last changed it (epoch ms; 0 = unknown). */
  mineAt: number;
  theirsAt: number;
}

export interface MergeResult {
  library: Library;
  conflicts: Conflict[];
  added: number;
  updated: number;
  removed: number;
}

const at = (c?: Card) => c?.updatedAt ?? 0;
/** Two cards are the same if only their edit time differs. */
const same = (a: Card, b: Card) => {
  const { updatedAt: _a, ...x } = a;
  const { updatedAt: _b, ...y } = b;
  return JSON.stringify(x) === JSON.stringify(y);
};

/** The default choice: the newer side; this device when unknown or equal. */
export const newer = (c: Conflict): Side => (c.theirsAt > c.mineAt ? 'theirs' : 'mine');

/**
 * Merges `backup` into `mine`. `choose` decides each conflict (default: newer wins); call once to list the
 * conflicts, show them, then again with the learner's choices.
 */
export function mergeLibraries(mine: Library, backup: Library, choose: (c: Conflict) => Side = newer): MergeResult {
  const mineDeleted = mine.deleted ?? {};
  const theirDeleted = backup.deleted ?? {};
  const conflicts: Conflict[] = [];
  let added = 0;
  let updated = 0;
  let removed = 0;
  const decide = (c: Conflict) => {
    conflicts.push(c);
    return choose(c);
  };

  const theirDecks = new Map(backup.decks.map((d) => [d.id, d]));
  const decks: Deck[] = [];

  for (const deck of mine.decks) {
    const theirs = theirDecks.get(deck.id);
    if (!theirs) {
      // Deleted on the other device after this backup knew it? Ask; a whole deck is too much to drop silently.
      const gone = theirDeleted[deck.id];
      if (gone) {
        const latest = Math.max(0, ...deck.cards.map(at));
        const side = decide({
          id: deck.id,
          deckTitle: deck.title,
          kind: 'deck-deleted-there',
          mine: `${deck.cards.length} card(s)`,
          mineAt: latest,
          theirsAt: gone,
        });
        if (side === 'theirs') {
          removed += deck.cards.length;
          continue;
        }
      }
      decks.push(deck);
      continue;
    }
    decks.push(mergeDeck(deck, theirs));
  }

  for (const theirs of backup.decks) {
    if (mine.decks.some((d) => d.id === theirs.id)) continue;
    const gone = mineDeleted[theirs.id];
    // Deleted here, and not edited on the other device since: stays deleted.
    if (gone && Math.max(0, ...theirs.cards.map(at)) <= gone) continue;
    decks.push(theirs);
    added += theirs.cards.length;
  }

  function mergeDeck(deck: Deck, theirs: Deck): Deck {
    const theirCards = new Map(theirs.cards.map((c) => [c.id, c]));
    const cards: Card[] = [];
    const key = (id: string) => `${deck.id}:${id}`;

    for (const card of deck.cards) {
      const other = theirCards.get(card.id);
      if (other) {
        if (same(card, other)) cards.push(card);
        else {
          const side = decide({
            id: key(card.id),
            deckTitle: deck.title,
            kind: 'edited',
            mine: cardSummary(card),
            theirs: cardSummary(other),
            mineAt: at(card),
            theirsAt: at(other),
          });
          cards.push(side === 'mine' ? card : other);
          if (side === 'theirs') updated++;
        }
        continue;
      }
      const gone = theirDeleted[key(card.id)];
      if (gone === undefined) cards.push(card); // new here
      else if (at(card) <= gone) removed++; // deleted there, unchanged here: deleted
      else {
        const side = decide({
          id: key(card.id),
          deckTitle: deck.title,
          kind: 'deleted-there',
          mine: cardSummary(card),
          mineAt: at(card),
          theirsAt: gone,
        });
        if (side === 'mine') cards.push(card);
        else removed++;
      }
    }

    for (const other of theirs.cards) {
      if (deck.cards.some((c) => c.id === other.id)) continue;
      const gone = mineDeleted[key(other.id)];
      if (gone === undefined || at(other) > gone) {
        const side =
          gone === undefined
            ? 'theirs'
            : decide({
                id: key(other.id),
                deckTitle: deck.title,
                kind: 'deleted-here',
                theirs: cardSummary(other),
                mineAt: gone,
                theirsAt: at(other),
              });
        if (side === 'theirs') {
          cards.push(other);
          added++;
        }
      }
    }

    // Deck name and settings stay as on this device; timed quizzes from the other side are added.
    const quizzes = [...(deck.quizzes ?? []), ...(theirs.quizzes ?? []).filter((q) => !deck.quizzes?.some((x) => x.id === q.id))];
    return { ...deck, cards, ...(quizzes.length ? { quizzes } : {}) };
  }

  // Learning progress: the most recently studied state of each question.
  const progress = { ...backup.progress };
  for (const [k, p] of Object.entries(mine.progress)) if (!progress[k] || p.last >= progress[k].last) progress[k] = p;

  // Quiz results from both sides, once each.
  const seen = new Set<string>();
  const attempts = [...(mine.attempts ?? []), ...(backup.attempts ?? [])]
    .filter((a: QuizAttempt) => {
      const k = `${a.deckId}|${a.quizId}|${a.at}`;
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .sort((a, b) => a.at - b.at);

  const customQuizzes: CustomQuiz[] = [
    ...(mine.customQuizzes ?? []),
    ...(backup.customQuizzes ?? []).filter((q) => !mine.customQuizzes?.some((x) => x.id === q.id)),
  ];

  // Remember deletions from both sides (latest time each).
  const deleted: Record<string, number> = { ...theirDeleted };
  for (const [k, t] of Object.entries(mineDeleted)) deleted[k] = Math.max(t, deleted[k] ?? 0);

  return {
    library: {
      ...mine, // appearance, settings and this device's connection stay
      decks,
      progress,
      attempts: attempts.length ? attempts : undefined,
      customQuizzes: customQuizzes.length ? customQuizzes : undefined,
      seeded: Array.from(new Set([...(mine.seeded ?? []), ...(backup.seeded ?? [])])),
      deleted: Object.keys(deleted).length ? deleted : undefined,
    },
    conflicts,
    added,
    updated,
    removed,
  };
}

/** Latest edit or deletion time in a library (0 = unknown): "your last change here". */
export function lastChange(lib: Library): number {
  const cards = lib.decks.flatMap((d) => d.cards.map(at));
  return Math.max(0, ...cards, ...Object.values(lib.deleted ?? {}));
}

// Turns one vocabulary entry into several questions. Each generated question has its own
// progress key (`cardId#variant`), so the scheduler tracks e.g. "knows the meaning" and
// "knows the article" separately.
import type { Card, Deck, StudyCard, StudyItem, VocabCard } from '../types';

export const VARIANT_LABELS: Record<string, string> = {
  read: 'Vocabulary · German → English',
  write: 'Vocabulary · English → German',
  article: 'Vocabulary · Article',
  plural: 'Vocabulary · Plural',
  meaning: 'Vocabulary · Meaning',
};

export const fullWord = (v: VocabCard) => (v.article ? `${v.article} ${v.word}` : v.word);

/** Cheap stable hash so generated multiple-choice options don't change between renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function expandVocab(v: VocabCard, deck?: Deck): StudyItem[] {
  const full = fullWord(v);
  const common = { tags: v.tags, hint: v.hint, time: v.time, image: v.image, hintImage: v.hintImage };
  const out: { variant: string; card: StudyCard }[] = [];

  out.push({
    variant: 'read',
    card: {
      ...common,
      id: `${v.id}#read`,
      type: 'flashcard',
      front: full,
      back: v.meaning,
      example: v.example,
      explanation: [v.plural ? `Plural: die ${v.plural}` : '', v.explanation ?? ''].filter(Boolean).join(' · ') || undefined,
    },
  });

  out.push({
    variant: 'write',
    card: {
      ...common,
      id: `${v.id}#write`,
      type: 'cloze',
      text: `{{${full}}}`,
      translation: v.meaning,
      // Nouns: the capital letter (and the article) is part of what you learn.
      caseSensitive: v.article ? true : undefined,
      explanation: v.example,
    },
  });

  if (v.article) {
    out.push({
      variant: 'article',
      card: {
        ...common,
        id: `${v.id}#article`,
        type: 'mcq',
        prompt: `___ ${v.word} (${v.meaning})`,
        options: ['der', 'die', 'das'],
        answer: [['der', 'die', 'das'].indexOf(v.article)],
        shuffle: false,
        explanation: v.explanation,
      },
    });
  }

  if (v.plural) {
    out.push({
      variant: 'plural',
      card: {
        ...common,
        id: `${v.id}#plural`,
        type: 'cloze',
        text: `${full} → die {{${v.plural}}}`,
        translation: `Plural of ${full} (${v.meaning})`,
        caseSensitive: true,
      },
    });
  }

  // Multiple choice on the meaning, with wrong options taken from other vocabulary in the deck.
  const others = (deck?.cards ?? [])
    .filter((c): c is VocabCard => c.type === 'vocab' && c.id !== v.id && c.meaning !== v.meaning)
    .map((c) => c.meaning)
    .filter((m, i, a) => a.indexOf(m) === i)
    .sort((a, b) => hash(v.id + a) - hash(v.id + b))
    .slice(0, 3);
  if (others.length === 3) {
    const options = [v.meaning, ...others];
    out.push({
      variant: 'meaning',
      card: {
        ...common,
        id: `${v.id}#meaning`,
        type: 'mcq',
        prompt: `What does „${full}“ mean?`,
        options,
        answer: [0],
        explanation: v.example,
      },
    });
  }

  return out.map(({ variant, card }) => ({
    key: card.id,
    sourceId: v.id,
    variant,
    card: JSON.parse(JSON.stringify(card)) as StudyCard,
  }));
}

/** Every question a card produces: itself, or the generated ones for vocabulary. */
export function expandCard(card: Card, deck?: Deck): StudyItem[] {
  if (card.type === 'vocab') return expandVocab(card, deck);
  return [{ key: card.id, sourceId: card.id, card }];
}

export function expandDeck(deck: Deck): StudyItem[] {
  return deck.cards.flatMap((c) => expandCard(c, deck));
}

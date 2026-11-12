// ---- Deck / card model. This is exactly what lives in the JSON files. ----

export type CardType =
  | 'flashcard'
  | 'mcq'
  | 'match'
  | 'cloze'
  | 'order'
  | 'categorize'
  | 'spot'
  | 'dictation'
  | 'vocab';

interface BaseCard {
  id: string;
  type: CardType;
  tags?: string[];
  hint?: string;
  /** Shown after answering (grammar rule, mnemonic, ...). */
  explanation?: string;
}

/** Classic two-sided card, self-graded. */
export interface FlashcardCard extends BaseCard {
  type: 'flashcard';
  front: string;
  back: string;
  example?: string;
}

/** Multiple choice. `answer` holds indexes into `options`; more than one = "select all that apply". */
export interface McqCard extends BaseCard {
  type: 'mcq';
  prompt: string;
  options: string[];
  answer: number[];
  /** Default true. Set false for fixed orders such as der / die / das. */
  shuffle?: boolean;
}

/** Match the following. The right-hand column is shuffled at study time. */
export interface MatchCard extends BaseCard {
  type: 'match';
  prompt?: string;
  pairs: { left: string; right: string }[];
}

/**
 * Complete the sentence. Blanks use {{answer}}, alternatives with |, an inline hint with ::
 * e.g. "Das Wetter ist {{schön|gut::adjective}}."
 */
export interface ClozeCard extends BaseCard {
  type: 'cloze';
  text: string;
  translation?: string;
  caseSensitive?: boolean;
  /** Pick answers from a word bank (tap or drag) instead of typing. */
  wordBank?: boolean;
  /** Extra wrong words for the word bank. */
  distractors?: string[];
}

/** Sort items into groups, e.g. der / die / das. */
export interface CategorizeCard extends BaseCard {
  type: 'categorize';
  prompt?: string;
  groups: { name: string; items: string[] }[];
}

/**
 * Find the mistake. Wrong words are marked [[wrong|correction]]:
 * "Ich [[habe|bin]] gestern nach Berlin gefahren."
 */
export interface SpotCard extends BaseCard {
  type: 'spot';
  prompt?: string;
  text: string;
  translation?: string;
}

/** Listen to the sentence (text-to-speech) and type it. */
export interface DictationCard extends BaseCard {
  type: 'dictation';
  text: string;
  translation?: string;
  caseSensitive?: boolean;
}

/**
 * One vocabulary entry that the app turns into several questions:
 * German → English, English → German, article, plural, meaning (multiple choice).
 */
export interface VocabCard extends BaseCard {
  type: 'vocab';
  word: string;
  article?: 'der' | 'die' | 'das';
  plural?: string;
  meaning: string;
  example?: string;
}

/** Put the words in the right order. `tokens` is the correct order; `accept` lists other valid sentences. */
export interface OrderCard extends BaseCard {
  type: 'order';
  prompt?: string;
  tokens: string[];
  accept?: string[];
  translation?: string;
}

export type Card =
  | FlashcardCard
  | McqCard
  | MatchCard
  | ClozeCard
  | OrderCard
  | CategorizeCard
  | SpotCard
  | DictationCard
  | VocabCard;

/** Cards that can be shown directly. Vocab entries are expanded into these first. */
export type StudyCard = Exclude<Card, VocabCard>;

/** One question in a study session. `key` is the card id, or `cardId#variant` for generated questions. */
export interface StudyItem {
  key: string;
  sourceId: string;
  variant?: string;
  card: StudyCard;
}

export interface Deck {
  id: string;
  title: string;
  description?: string;
  /** BCP-47 language codes, e.g. { target: 'de', native: 'en' }. */
  language: { target: string; native: string };
  tags?: string[];
  cards: Card[];
}

/** One exported deck file (*.quizzo.json). */
export interface DeckFile {
  format: 'quizzo-deck';
  version: 1;
  deck: Deck;
}

// ---- Learning progress. Kept apart from decks so deck files stay clean to share. ----

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface CardProgress {
  reps: number;
  lapses: number;
  ease: number;
  /** Days. */
  interval: number;
  /** Epoch ms when the card is next due. */
  due: number;
  last: number;
}

export interface Library {
  format: 'quizzo-library';
  version: 1;
  decks: Deck[];
  /** Keyed by `${deckId}:${cardId}`. */
  progress: Record<string, CardProgress>;
  /** Built-in deck ids this library has already received (so deleted ones aren't re-added). */
  seeded?: string[];
}

export interface AnswerResult {
  correct: boolean;
  grade: Grade;
}

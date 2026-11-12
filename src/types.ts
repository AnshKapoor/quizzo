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
  | 'vocab'
  | 'sequence'
  | 'table';

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

/** Drag the lines into the right order (steps, dialogue lines, days of the week). `items` is the correct order. */
export interface SequenceCard extends BaseCard {
  type: 'sequence';
  prompt?: string;
  items: string[];
}

/**
 * Fill the table by dragging words into the cells, e.g. a conjugation table.
 * `columns` are the headers; the first cell of each row is its label and is shown, the other cells are blanks.
 */
export interface TableCard extends BaseCard {
  type: 'table';
  prompt?: string;
  columns: string[];
  rows: string[][];
  /** Extra wrong words for the word bank. */
  distractors?: string[];
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
  | VocabCard
  | SequenceCard
  | TableCard;

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
  /** Saved timed quizzes (tests) for this deck. */
  quizzes?: QuizPreset[];
}

/** A timed quiz set up for a deck, so the same test can be taken again or shared with the deck file. */
export interface QuizPreset {
  id: string;
  title: string;
  /** How many questions to draw. 0 = all matching questions. */
  questions: number;
  /** Time for the whole quiz in seconds. 0 = no overall limit. */
  timeLimit: number;
  /** Seconds per question; when it runs out the question counts as missed. 0 = no limit. */
  perQuestion: number;
  /** Only use these card types (empty / missing = all). */
  types?: CardType[];
  /** Only use cards with at least one of these tags (empty / missing = all). */
  tags?: string[];
}

/** One finished timed quiz. */
export interface QuizAttempt {
  deckId: string;
  quizId: string;
  /** Epoch ms when it finished. */
  at: number;
  correct: number;
  total: number;
  /** Seconds taken. */
  seconds: number;
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
  /** Results of timed quizzes, newest last. */
  attempts?: QuizAttempt[];
}

export interface AnswerResult {
  correct: boolean;
  grade: Grade;
}

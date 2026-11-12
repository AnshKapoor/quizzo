// In-app help: what each card type is for, how to fill in its editor fields, and a ready-made example.
import type { Card, CardType, Deck } from '../types';

export interface CardHelp {
  /** One line: what the learner does. */
  summary: string;
  /** When this type is a good choice. */
  goodFor: string;
  /** How to fill in the editor, field by field. */
  steps: string[];
  /** A complete example card ("Fill in an example" in the editor, live demo on the help screen). */
  example: Card;
}

export const CARD_HELP: Record<CardType, CardHelp> = {
  vocab: {
    summary: 'Enter a word once and the app makes up to 5 questions from it.',
    goodFor: 'Learning new words. The quickest way to build a vocabulary deck.',
    steps: [
      'Article: der, die or das for nouns. Leave it on "(none)" for verbs, adjectives and phrases.',
      'Word: the German word without the article, e.g. Tisch.',
      'Plural: only the plural form, without "die", e.g. Tische. Leave empty if there is none.',
      'Meaning: the English translation, e.g. table.',
      'Example sentence: optional, shown with the answer.',
      'Questions made: German → English, English → German, the article, the plural, and the meaning as multiple choice (once the deck has 4 or more vocabulary entries).',
    ],
    example: {
      id: 'help-vocab',
      type: 'vocab',
      word: 'Tisch',
      article: 'der',
      plural: 'Tische',
      meaning: 'table',
      example: 'Der Tisch ist neu.',
    },
  },
  flashcard: {
    summary: 'A classic two-sided card. Flip it, then grade yourself Again / Hard / Good / Easy.',
    goodFor: 'Phrases, idioms, and anything that does not fit another type.',
    steps: [
      'Front: what the learner sees first, e.g. Wie geht es dir?',
      'Back: the answer, e.g. How are you?',
      'Example sentence: optional, shown on the back.',
    ],
    example: {
      id: 'help-flashcard',
      type: 'flashcard',
      front: 'Wie geht es dir?',
      back: 'How are you? (informal)',
      example: 'Hallo Anna, wie geht es dir?',
    },
  },
  mcq: {
    summary: 'Pick the right answer from a list. Several right answers make it "select all that apply".',
    goodFor: 'Articles, grammar choices, and checking meaning.',
    steps: [
      'Question: e.g. ___ Mädchen spielt im Garten.',
      'Options: one option per line. Put * in front of every correct option, e.g. *Das.',
      'Mark two or more options with * and the learner must select all of them.',
      'Untick "Shuffle options" to keep a fixed order such as der / die / das.',
    ],
    example: {
      id: 'help-mcq',
      type: 'mcq',
      prompt: '___ Mädchen spielt im Garten.',
      options: ['Der', 'Die', 'Das'],
      answer: [2],
      shuffle: false,
      explanation: 'Words ending in -chen are always neuter: das Mädchen.',
    },
  },
  match: {
    summary: 'Pair the items of two shuffled columns, by tapping or dragging.',
    goodFor: 'Word ↔ translation, question ↔ answer, opposites.',
    steps: [
      'Instruction: optional, e.g. Match the colours.',
      'Pairs: one pair per line, written as left = right, e.g. rot = red.',
      'Use at least 2 pairs; 4 to 6 works best.',
    ],
    example: {
      id: 'help-match',
      type: 'match',
      prompt: 'Match the colours',
      pairs: [
        { left: 'rot', right: 'red' },
        { left: 'blau', right: 'blue' },
        { left: 'grün', right: 'green' },
        { left: 'gelb', right: 'yellow' },
      ],
    },
  },
  cloze: {
    summary: 'Fill the gaps in a sentence, by typing or by picking words from a word bank.',
    goodFor: 'Verb endings, articles, prepositions: grammar in context.',
    steps: [
      'Sentence: wrap each gap in double curly brackets, e.g. Ich {{wohne}} in Berlin.',
      'Several right answers: separate them with |, e.g. {{schön|gut}}.',
      'A hint inside the empty gap: add it after ::, e.g. {{wohne::wohnen}}.',
      'Tick "Word bank" to let the learner drag words in instead of typing; add wrong words under "Extra wrong words".',
      'Typing ae / oe / ue / ss for ä / ö / ü / ß is accepted. Tick "Capitalisation must match" for nouns.',
    ],
    example: {
      id: 'help-cloze',
      type: 'cloze',
      text: 'Ich {{wohne::wohnen}} in Berlin und {{arbeite::arbeiten}} in Potsdam.',
      translation: 'I live in Berlin and work in Potsdam.',
    },
  },
  order: {
    summary: 'Build a sentence by putting word tiles in order (tap or drag).',
    goodFor: 'German word order: verb second, verb at the end, questions.',
    steps: [
      'Correct sentence: type it normally; it is split into words at the spaces.',
      'Keep several words on one tile with |, e.g. Ich | habe | Fußball gespielt.',
      'Other correct orders: optional, one full sentence per line (e.g. Ich fahre morgen nach Berlin.).',
      'Case and punctuation are ignored when checking.',
    ],
    example: {
      id: 'help-order',
      type: 'order',
      tokens: ['Morgen', 'fahre', 'ich', 'nach', 'Berlin.'],
      accept: ['Ich fahre morgen nach Berlin.'],
      translation: "Tomorrow I'm going to Berlin.",
      explanation: 'The verb comes second, even when the sentence starts with "Morgen".',
    },
  },
  categorize: {
    summary: 'Drag words into the right group.',
    goodFor: 'der / die / das, separable vs. inseparable verbs, word families.',
    steps: [
      'Instruction: optional, e.g. Sort by article.',
      'Groups: one group per line, written as name: item, item, item.',
      'Example line: der: Löffel, Garten',
      'You need at least 2 groups, each with at least one item.',
    ],
    example: {
      id: 'help-categorize',
      type: 'categorize',
      prompt: 'Sort by article',
      groups: [
        { name: 'der', items: ['Löffel', 'Garten'] },
        { name: 'die', items: ['Gabel', 'Zeitung'] },
        { name: 'das', items: ['Messer', 'Mädchen'] },
      ],
    },
  },
  spot: {
    summary: 'Tap the wrong word(s) in a sentence. The corrections are shown afterwards.',
    goodFor: 'Typical mistakes: wrong verb form, wrong case, wrong auxiliary verb.',
    steps: [
      'Sentence: write it with the mistake, and mark each wrong word as [[wrong|correction]].',
      'Example: Ich [[habe|bin]] gestern nach Berlin gefahren.',
      'A word that should be removed: leave the correction empty, e.g. [[sehr|]].',
      'With several marked mistakes the learner must find all of them.',
    ],
    example: {
      id: 'help-spot',
      type: 'spot',
      prompt: 'Find the mistake',
      text: 'Ich [[habe|bin]] gestern nach Berlin gefahren.',
      translation: 'I went to Berlin yesterday.',
      explanation: 'Verbs of movement (fahren, gehen, fliegen) form the perfect tense with sein.',
    },
  },
  dictation: {
    summary: 'Listen to a sentence (normal or slow) and type what you hear.',
    goodFor: 'Listening and spelling.',
    steps: [
      'Sentence to read aloud: the exact text the learner should type.',
      'Translation: optional, shown after answering.',
      'Case and punctuation are ignored unless "Capitalisation must match" is ticked.',
      'Read-aloud uses the device voice; it works on desktop and in the browser.',
    ],
    example: {
      id: 'help-dictation',
      type: 'dictation',
      text: 'Wie spät ist es?',
      translation: 'What time is it?',
    },
  },
  sequence: {
    summary: 'Drag lines into the right order (or tap two lines to swap them).',
    goodFor: 'Conversations, daily routines, steps of a story, days and months.',
    steps: [
      'Instruction: optional, e.g. Put the conversation in order.',
      'Lines: one per line, in the correct order from top to bottom. The app shuffles them.',
      'Use at least 2 lines; 4 to 6 works best.',
    ],
    example: {
      id: 'help-sequence',
      type: 'sequence',
      prompt: 'Put the conversation in order',
      items: ['Guten Tag! Was möchten Sie?', 'Einen Kaffee, bitte.', 'Mit Milch?', 'Ja, gern.'],
    },
  },
  table: {
    summary: 'Drag words from a word bank into the cells of a table.',
    goodFor: 'Conjugation and declension tables.',
    steps: [
      'Table: the first line holds the column headers, separated by |, e.g. Person | sein | haben.',
      'Then one row per line: ich | bin | habe. Every row needs one cell per column.',
      'The first cell of each row is shown as its label; the other cells are what the learner fills in.',
      'Leave the top-left header empty by starting the first line with |, e.g. | sein | haben.',
      'Extra wrong words: optional, comma separated, added to the word bank.',
    ],
    example: {
      id: 'help-table',
      type: 'table',
      prompt: 'Conjugate sein and haben',
      columns: ['', 'sein', 'haben'],
      rows: [
        ['ich', 'bin', 'habe'],
        ['du', 'bist', 'hast'],
        ['er/sie/es', 'ist', 'hat'],
      ],
      distractors: ['seid'],
    },
  },
};

/** A deck with one example of every card type and a short timed quiz, to explore the app. */
export function exampleDeck(id: string): Deck {
  return {
    id,
    title: 'Examples: every card type',
    description: 'One card of each type. Open a card to see how it is written.',
    language: { target: 'de', native: 'en' },
    cards: Object.values(CARD_HELP).map((h) => h.example),
    quizzes: [{ id: 'q-example', title: 'Try a timed quiz', questions: 5, timeLimit: 120, perQuestion: 0 }],
  };
}

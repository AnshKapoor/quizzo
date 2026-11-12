# Quizzo deck format (v1)

Decks are plain JSON, so you can write them by hand, generate them with a script or an LLM,
or share them as files. File extension convention: `*.quizzo.json`.

```json
{
  "format": "quizzo-deck",
  "version": 1,
  "deck": {
    "id": "deck-de-a1-starter",
    "title": "Deutsch A1 – Starter",
    "description": "optional",
    "language": { "target": "de", "native": "en" },
    "tags": ["A1"],
    "cards": [ ... ]
  }
}
```

The importer also accepts a **bare deck** (`{ "title": ..., "cards": [...] }`) and a **full backup**
(`{ "format": "quizzo-library", "decks": [...] }`). Missing card ids are generated; invalid cards are skipped
and listed after import.

## Fields every card can have

| field         | required | meaning                                              |
|---------------|----------|------------------------------------------------------|
| `id`          | no*      | unique within the deck (*generated if missing)       |
| `type`        | yes      | `vocab`, `flashcard`, `mcq`, `match`, `cloze`, `order`, `categorize`, `spot`, `dictation`, `sequence`, `table` |
| `hint`        | no       | shown before answering (flashcards)                  |
| `explanation` | no       | grammar note shown after answering                   |
| `tags`        | no       | list of strings                                      |

## Card types

### `flashcard` – flip and self-grade (Again / Hard / Good / Easy)
```json
{ "type": "flashcard", "front": "der Hund", "back": "the dog", "example": "Der Hund schläft." }
```

### `mcq` – multiple choice
`answer` is a list of option indexes (0-based). More than one index = "select all that apply".
`"shuffle": false` keeps the order (useful for der / die / das).
```json
{ "type": "mcq", "prompt": "___ Mädchen", "options": ["der", "die", "das"], "answer": [2], "shuffle": false }
```

### `match` – match the following
The learner pairs left with right items; both columns are shuffled. Any wrong attempt marks the card as missed.
```json
{ "type": "match", "prompt": "Match the colours",
  "pairs": [ { "left": "rot", "right": "red" }, { "left": "blau", "right": "blue" } ] }
```

### `cloze` – complete the sentence
Blanks are written as `{{answer}}`. Alternatives: `{{schön|gut}}`. A hint shown in the empty field: `{{heiße::heißen}}`.
Typing `ae/oe/ue/ss` instead of `ä/ö/ü/ß` is accepted (with a gentle note). `caseSensitive: true` checks capitalisation.
```json
{ "type": "cloze", "text": "Ich habe {{einen}} Bruder.", "translation": "I have a brother.", "caseSensitive": false }
```

### `order` – put the words in order
`tokens` is the correct sentence, split into tiles. `accept` lists other valid word orders.
Comparison ignores case and punctuation.
```json
{ "type": "order", "tokens": ["Morgen", "fahre", "ich", "nach", "Berlin."],
  "accept": ["Ich fahre morgen nach Berlin."], "translation": "Tomorrow I'm going to Berlin." }
```

### `cloze` with a word bank
Add `"wordBank": true` to pick words by tapping or dragging instead of typing. The correct answers go into the
bank automatically; `distractors` adds wrong ones.
```json
{ "type": "cloze", "text": "Ich gebe {{dem}} Mann das Buch.", "wordBank": true, "distractors": ["der", "den", "des"] }
```

### `categorize` – sort into groups
Drag (or tap) each item into its group. Needs at least 2 groups.
```json
{ "type": "categorize", "prompt": "Sort by article", "groups": [
  { "name": "der", "items": ["Löffel", "Garten"] },
  { "name": "die", "items": ["Gabel", "Zeitung"] },
  { "name": "das", "items": ["Messer", "Mädchen"] } ] }
```

### `spot` – find the mistake
Mark each mistake as `[[wrong|correction]]`. The learner taps the wrong words; with several mistakes all must be found.
`[[word|]]` means the word should be deleted.
```json
{ "type": "spot", "text": "Ich [[habe|bin]] gestern nach Berlin gefahren.", "translation": "I went to Berlin yesterday." }
```

### `dictation` – listen and type
The sentence is read aloud (normal or slow) and the learner types it. Case and punctuation are ignored unless
`caseSensitive` is set; ae/oe/ue/ss are accepted for ä/ö/ü/ß. Missed words are highlighted.
```json
{ "type": "dictation", "text": "Wie spät ist es?", "translation": "What time is it?" }
```

### `sequence` – drag the lines into order
`items` is the correct order, top to bottom; they are shuffled when studying. Good for conversations, steps of a
routine, days or months. Drag a line to its place, tap two lines to swap them, or use the ▲▼ buttons.
```json
{ "type": "sequence", "prompt": "Put the conversation in order",
  "items": ["Guten Tag! Was möchten Sie?", "Einen Kaffee, bitte.", "Mit Milch?", "Ja, gern."] }
```

### `table` – fill the table
`columns` are the headers. In each row the first cell is shown as the row label; the other cells are blanks the
learner fills by dragging words from a bank (or tapping). Every row must have one cell per column.
`distractors` adds wrong words to the bank. Good for conjugation and declension tables.
```json
{ "type": "table", "prompt": "Conjugate sein and haben", "columns": ["", "sein", "haben"],
  "rows": [["ich", "bin", "habe"], ["du", "bist", "hast"], ["er/sie/es", "ist", "hat"]], "distractors": ["seid"] }
```

### `vocab` – one word entry, several questions
Write a word once and the app generates up to five questions, each scheduled separately:

| question            | when                                  |
|---------------------|---------------------------------------|
| German → English    | always (flashcard)                    |
| English → German    | always (typed; nouns need article and capital letter) |
| Article             | if `article` is set (der / die / das) |
| Plural              | if `plural` is set                    |
| Meaning             | if the deck has 4+ vocab entries (multiple choice, other entries' meanings as wrong options) |

```json
{ "type": "vocab", "word": "Tisch", "article": "der", "plural": "Tische", "meaning": "table", "example": "Der Tisch ist neu." }
```

## Timed quizzes

A deck can carry saved timed quizzes (tests) in `quizzes`. They travel with the deck file, so a teacher can share
a deck together with its tests. Each run draws a fresh random set of questions.

| field         | meaning                                                                   |
|---------------|---------------------------------------------------------------------------|
| `id`          | unique within the deck (generated if missing)                             |
| `title`       | name shown in the app                                                     |
| `questions`   | how many questions to draw; `0` = all matching questions                  |
| `timeLimit`   | seconds for the whole quiz; `0` = no overall limit. At 0:00 the quiz ends |
| `perQuestion` | seconds per question; `0` = no limit. When it runs out the question counts as missed |
| `types`       | optional: only these card types (a `vocab` entry counts as `vocab`)       |
| `tags`        | optional: only cards with at least one of these tags                      |

```json
"quizzes": [
  { "id": "q-a1-test", "title": "A1 quick test", "questions": 10, "timeLimit": 300, "perQuestion": 0 },
  { "id": "q-verbs", "title": "Speed round: verbs", "questions": 8, "timeLimit": 0, "perQuestion": 30, "tags": ["verbs"] }
]
```

Results of finished quizzes are kept in the library (`attempts`, last 20 per quiz), not in the deck file.

## Learning progress

Progress is **not** part of a deck file, so shared decks stay clean. It lives in the library
(`progress`, keyed `deckId:cardId`, or `deckId:cardId#variant` for questions generated from a `vocab` entry)
and is included in the "Back up all" export.

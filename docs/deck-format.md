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
| `type`        | yes      | `vocab`, `flashcard`, `mcq`, `match`, `cloze`, `order`, `categorize`, `spot`, `dictation` |
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

## Learning progress

Progress is **not** part of a deck file, so shared decks stay clean. It lives in the library
(`progress`, keyed `deckId:cardId`, or `deckId:cardId#variant` for questions generated from a `vocab` entry)
and is included in the "Back up all" export.

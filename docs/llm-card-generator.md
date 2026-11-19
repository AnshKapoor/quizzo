# Quizzo card generator: prompt for an LLM

Paste everything between the two lines below into ChatGPT, Gemini, Claude or any other chat model **once**.
After that, send it a single word (or phrase) and it answers with ready-to-paste text for every card type.
Open the card editor in Quizzo (Edit → New card), pick the card type and paste each block into the field with
the same name.

Want a file you can import instead? Send `json: <word>` and it returns one deck file (see
[deck-format.md](deck-format.md)) that you save as `something.quizzo.json` and import.

---

You are a card writer for the language-learning app Quizzo. The learner studies German and speaks English
(if I name other languages, use those instead). I will send you one word or short phrase. You make study
material for it in **every** card type below, in exactly the formats shown, so I can copy each block straight
into the matching field of the card editor.

## Output rules

- Reply with the 12 sections below, in this order, and nothing else: no introduction, no closing remarks.
- Each field is a heading line with the field's name, followed by its content in its own code block, so I can
  copy it with one click. Leave out fields that have nothing in them (say `(empty)` for optional ones).
- Write natural, correct A1–B1 German unless I ask for another level. Every sentence must be grammatically
  correct and about the word I gave you; use the word itself in each card. Vary the sentences between cards.
- Use real German characters (ä ö ü ß), never ae/oe/ue/ss.
- Do not use Markdown formatting (bold, bullets, numbering) **inside** a code block. Code blocks hold only the
  text to paste, exactly as it should appear in the field.
- Keep to the line formats described for each field; the app reads them literally.
- If the word is not a noun, skip the article and plural, and say so in one line at the top of section 1.

## The 12 sections

For each section, print the heading, then the listed fields.

**1. Vocabulary** (one entry; the app makes several questions from it)
Fields: `Word` (no article), `Article` (der, die or das; nouns only), `Plural (without "die")`, `Meaning`,
`Example sentence`.

**2. Flashcard**
Fields: `Front (German)`, `Back (meaning)`, `Example sentence`, `Hint` (a short memory aid or clue; no
spoilers).

**3. Multiple choice**
Fields: `Question`, `Options`, and whether to tick `Shuffle options` (untick it only for fixed orders such as der / die / das).
`Options`: one option per line, 3 or 4 options, a `*` in front of each correct one, e.g. `*die`. Ask about the
word (its meaning, its article, or the right form), with plausible wrong answers.

**4. Match the following**
Fields: `Instruction`, `Pairs`.
`Pairs`: 4 to 6 lines of `German = English`. Use the word and closely related words (family, synonyms,
opposites, compounds).

**5. Complete the sentence** (typed)
Fields: `Sentence or paragraph`, `Translation`.
Write the blank as `{{answer}}`. Alternatives: `{{schön|gut}}`. A small hint shown in the empty field:
`{{heiße::heißen}}`. One or two blanks; the word I gave you is one of the answers.

**6. Word bank** (complete the sentence by picking words)
Fields: `Text with gaps`, `Translation`, `Extra wrong words in the box (optional)`.
Same `{{answer}}` syntax as above. Extra words: 2 to 4 wrong but tempting words, separated by commas.

**7. Word order**
Fields: `Instruction`, `Correct sentence`, `Other correct orders`, `Translation`.
`Correct sentence`: the sentence with its words separated by spaces. If the sentence has more than 8 words,
split it into short chunks and separate the chunks with ` | ` instead (for example
`Die Unternehmensleitung | hat beschlossen, | den Mitarbeitern | neue Pflichten aufzuerlegen.`), so the app
shows 4 to 8 tiles. Keep the sentence under 15 words.
`Other correct orders`: one full alternative sentence per line if another word order is also correct
(for example, starting with the time), otherwise `(empty)`.

**8. Sort into groups**
Fields: `Instruction`, `Groups`.
`Groups`: one group per line as `Group name: item, item, item`, 2 to 4 groups, 2 to 4 items each. Typical
choice: sort by article (der / die / das), or by category. Items must clearly belong to one group.

**9. Find the mistake**
Fields: `Instruction`, `Sentence with mistake(s)`, `Translation`.
Mark each mistake as `[[wrong word|correction]]`. A word that should be deleted: `[[word|]]`. One or two
mistakes, in the kinds of errors learners really make (article, verb form, word order, auxiliary verb).

**10. Dictation**
Fields: `Sentence to read aloud`, `Translation (shown after answering)`.
One clear sentence of 5 to 10 words that contains the word.

**11. Sequence**
Fields: `Instruction`, `Lines in the correct order`.
`Lines in the correct order`: 3 to 5 lines, one per line, in the right order (a short dialogue or the steps of
a routine that involve the word).

**12. Fill the table**
Fields: `Instruction`, `Table`, `Extra wrong words for the bank`.
`Table`: first line = column headers, separated by ` | `, then one row per line, also separated by ` | `. The
first cell of each row is its label and is shown; the other cells are filled in by the learner. Every row has
one cell per column. For a verb: a present-tense conjugation table (ich, du, er/sie/es, wir, ihr, sie/Sie).
For a noun: singular and plural, or the cases. For other words: pick the most useful small table, for
example the word with its related forms. Extra wrong words: comma separated, 2 or 3.

## Every card, at the end

These fields sit under "More options" in the editor and work for every card type. After section 12 add one
more block, `Tags`, with 2 or 3 comma-separated tags (for example `A1, food`) that fit
all the cards, and a block `Explanation shown after answering` with one or two short sentences of grammar or a
memory aid about the word (leave it `(empty)` if there is nothing useful to say).

---

## When I send `json: <word>`

Reply with one JSON file only (no text around it), shaped like this, with one card of each of these types:
`vocab`, `flashcard`, `mcq`, `match`, `cloze`, `cloze` with `"wordBank": true`, `order`, `categorize`, `spot`,
`dictation`, `sequence`, `table`:

```json
{
  "format": "quizzo-deck",
  "version": 1,
  "deck": {
    "id": "deck-<word>",
    "title": "<word>",
    "language": { "target": "de", "native": "en" },
    "tags": [],
    "cards": []
  }
}
```

Use the same rules for the cards as above. The card fields are the ones from the Quizzo deck format:
`vocab` {word, article, plural, meaning, example}, `flashcard` {front, back, example, hint}, `mcq` {prompt,
options, answer (0-based indexes of the correct options), shuffle}, `match` {prompt, pairs: [{left, right}]},
`cloze` {text, translation, wordBank, distractors}, `order` {prompt, tokens (a list of the words or chunks in
the correct order), accept (a list of other correct sentences), translation}, `categorize` {prompt, groups:
[{name, items}]}, `spot` {prompt, text, translation}, `dictation` {text, translation}, `sequence` {prompt,
items}, `table` {prompt, columns, rows (a list of lists), distractors}. Give every card a unique `id`, and
the same optional `explanation` and `tags`.

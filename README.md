# Quizzo

Interactive flashcards with quiz-style card types, for desktop (Windows/macOS/Linux) and Android.
First focus: learning German. Decks are JSON files that are easy to import, export and share.

## Card types

| Type                  | How it works                                                      |
|-----------------------|-------------------------------------------------------------------|
| Vocabulary            | Enter a word once; generates up to 5 questions (both directions, article, plural, meaning) |
| Flashcard             | Flip, then grade yourself Again / Hard / Good / Easy              |
| Multiple choice       | One answer, or "select all that apply"                            |
| Match the following   | Pair the items in two shuffled columns (tap or drag)              |
| Complete the sentence | Type into blanks (ä/ö/ü/ß buttons; ae/oe/ue/ss accepted), or pick from a word bank |
| Word order            | Build the sentence from word tiles; other valid orders allowed     |
| Sort into groups      | Drag words into groups such as der / die / das                    |
| Find the mistake      | Tap the wrong word(s); corrections shown afterwards              |
| Dictation             | Listen (normal or slow) and type; missed words highlighted       |

Drag and drop uses pointer events, so it works with mouse and touch; every drag can also be done by tapping.

Two ways to study a deck:
- **Study**: spaced repetition (SM-2 style). Due cards plus up to 10 new ones; missed cards come back once at the end.
- **Quiz**: 10 random cards with a score at the end.

Other features: card editor with a live preview, text-to-speech (🔊, desktop/browser), keyboard shortcuts
(Space reveals, 1–4 grade, Enter next, Esc exits), light/dark theme, phone-sized layout.

## Stack

- **React + TypeScript + Vite**: the whole app, one codebase (`src/`)
- **Electron**: desktop shell (`electron/`). Library saved to `%APPDATA%\quizzo\library.json`
- **Capacitor**: Android shell (`android/`). Library currently saved in WebView storage

## Running it

```bash
npm install
```

Browser (fastest while developing):
```bash
npm run dev
```

Desktop app:
```bash
npm run desktop
```

Desktop with hot reload (start `npm run dev` first, in another terminal):
```bash
npm run desktop:dev
```

Android (needs Android Studio + JDK 21):
```bash
npm run android:sync
```
```bash
npm run android:open
```
Then press Run in Android Studio.

Tests and type checks:
```bash
npm test
```
```bash
npm run typecheck
```

## Layout

```
src/
  types.ts                 data model (= JSON schema)
  data/                    built-in decks (German A1 starter + practice); new ones reach existing installs once
  lib/                     answer checking, cloze parser, scheduler, validation, storage
  components/cards/        one component per card type
  screens/                 Home, DeckView, CardEditor, Study
electron/                  desktop main + preload (JSON file storage)
android/                   generated Capacitor project
docs/deck-format.md        JSON deck format reference
```

## Adding a new card type

1. Add the interface to `src/types.ts` and include it in the `Card` union.
2. Validate it in `src/lib/validate.ts`.
3. Map it to/from form fields in `src/lib/cardForm.ts` and add fields in `screens/CardEditor.tsx`.
4. Write `components/cards/XxxView.tsx` and register it in `CardView.tsx`.

## Known gaps / next steps

- Android: export uses a browser download, which the WebView can't do. Add `@capacitor/filesystem` + `@capacitor/share`.
- Android: no text-to-speech in the WebView yet (needs a Capacitor TTS plugin), so dictation falls back to showing
  the sentence. Store the library in a file rather than WebView storage.
- Vocabulary: start new words as multiple choice and switch to typing once they're known.
- Desktop installers: add `electron-builder`.
- Card ideas: conjugation/declension tables, rewrite-the-sentence, label a picture, reading passages, speaking.
- More languages: `deck.language.target` already drives TTS and the special-character bar.

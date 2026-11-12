import { useEffect, useState } from 'react';
import type { CardType, Library } from './types';
import * as L from './lib/library';
import { loadLibrary, readFileText, saveLibrary } from './lib/storage';
import { uid } from './lib/util';
import { parseImport } from './lib/validate';
import { Home } from './screens/Home';
import { DeckView } from './screens/DeckView';
import { CardEditor } from './screens/CardEditor';
import { Study } from './screens/Study';
import { TimedQuiz } from './screens/TimedQuiz';
import { addAttempt } from './lib/quiz';

type View =
  | { name: 'home' }
  | { name: 'deck'; deckId: string }
  | { name: 'study'; deckId: string; mode: 'review' | 'quiz' }
  | { name: 'test'; deckId: string; quizId: string }
  | { name: 'edit'; deckId: string; cardId?: string; type: CardType };

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [view, setView] = useState<View>({ name: 'home' });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary().then(setLib);
  }, []);

  // Persist (debounced) whenever the library changes.
  useEffect(() => {
    if (!lib) return;
    const t = setTimeout(() => {
      saveLibrary(lib)
        .then(() => setSaveError(null))
        .catch((e) => setSaveError(String(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [lib]);

  if (!lib) return <div className="loading">Loading…</div>;

  const update = (fn: (l: Library) => Library) => setLib((l) => (l ? fn(l) : l));
  const deck = 'deckId' in view ? lib.decks.find((d) => d.id === view.deckId) : undefined;
  const home = () => setView({ name: 'home' });

  const importFile = async (file: File) => {
    const { decks, errors } = parseImport(await readFileText(file));
    if (!decks.length) {
      alert(`Nothing imported.\n\n${errors.slice(0, 10).join('\n')}`);
      return;
    }
    update((l) =>
      L.addImportedDecks(l, decks, (d) =>
        confirm(`A deck "${d.title}" already exists.\n\nOK = replace it\nCancel = import as a copy`),
      ),
    );
    const cards = decks.reduce((n, d) => n + d.cards.length, 0);
    const skipped = errors.length ? `\n\n${errors.length} problem(s) skipped:\n${errors.slice(0, 10).join('\n')}` : '';
    alert(`Imported ${decks.length} deck(s), ${cards} card(s).${skipped}`);
  };

  let screen;
  if (view.name === 'home' || !deck) {
    screen = (
      <Home
        library={lib}
        onOpen={(deckId) => setView({ name: 'deck', deckId })}
        onStudy={(deckId, mode) => setView({ name: 'study', deckId, mode })}
        onImport={importFile}
        onNewDeck={() => {
          const id = uid('deck-');
          update((l) => L.upsertDeck(l, { id, title: 'New deck', language: { target: 'de', native: 'en' }, cards: [] }));
          setView({ name: 'deck', deckId: id });
        }}
      />
    );
  } else if (view.name === 'deck') {
    screen = (
      <DeckView
        deck={deck}
        library={lib}
        onBack={home}
        onChange={(d) => update((l) => L.upsertDeck(l, d))}
        onStudy={(mode) => setView({ name: 'study', deckId: deck.id, mode })}
        onTimedQuiz={(quizId) => setView({ name: 'test', deckId: deck.id, quizId })}
        onAddCard={(type) => setView({ name: 'edit', deckId: deck.id, type })}
        onEditCard={(cardId) => {
          const c = deck.cards.find((x) => x.id === cardId);
          if (c) setView({ name: 'edit', deckId: deck.id, cardId, type: c.type });
        }}
        onDeleteCard={(cardId) => update((l) => L.removeCard(l, deck.id, cardId))}
        onDeleteDeck={() => {
          update((l) => L.removeDeck(l, deck.id));
          home();
        }}
        onResetProgress={() => update((l) => L.resetDeckProgress(l, deck.id))}
      />
    );
  } else if (view.name === 'study') {
    screen = (
      <Study
        key={`${deck.id}-${view.mode}`}
        deck={deck}
        library={lib}
        mode={view.mode}
        onRecord={(cardId, grade) => update((l) => L.recordAnswer(l, deck.id, cardId, grade))}
        onExit={() => setView({ name: 'deck', deckId: deck.id })}
      />
    );
  } else if (view.name === 'test') {
    const quiz = deck.quizzes?.find((q) => q.id === view.quizId);
    const back = () => setView({ name: 'deck', deckId: deck.id });
    screen = quiz ? (
      <TimedQuiz
        key={`${deck.id}-${quiz.id}`}
        deck={deck}
        library={lib}
        quiz={quiz}
        onRecord={(cardId, grade) => update((l) => L.recordAnswer(l, deck.id, cardId, grade))}
        onFinish={(attempt) => update((l) => addAttempt(l, attempt))}
        onExit={back}
      />
    ) : (
      <div className="empty">
        <p>This quiz no longer exists.</p>
        <button type="button" onClick={back}>
          Back to deck
        </button>
      </div>
    );
  } else {
    const back = () => setView({ name: 'deck', deckId: deck.id });
    screen = (
      <CardEditor
        key={view.cardId ?? 'new'}
        deck={deck}
        card={deck.cards.find((c) => c.id === view.cardId)}
        type={view.type}
        onCancel={back}
        onSave={(card, another) => {
          update((l) => L.saveCard(l, deck.id, card));
          if (!another) back();
        }}
      />
    );
  }

  return (
    <>
      {saveError && <div className="banner error">Could not save: {saveError}</div>}
      {screen}
    </>
  );
}

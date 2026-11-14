import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardType, CustomQuiz, Library } from './types';
import * as L from './lib/library';
import { loadLibrary, readFileText, saveLibrary } from './lib/storage';
import { uid } from './lib/util';
import { parseImport } from './lib/validate';
import { Home } from './screens/Home';
import { DeckView } from './screens/DeckView';
import { CardEditor } from './screens/CardEditor';
import { Study } from './screens/Study';
import { TimedQuiz } from './screens/TimedQuiz';
import {
  addAttempt,
  CUSTOM_QUIZ_OWNER,
  customQuizItems,
  deckQuizItems,
  newCustomQuiz,
  defaultQuestionTime,
  quizAttempts,
  removeCustomQuiz,
  upsertCustomQuiz,
} from './lib/quiz';
import { applyAppearance, normalizeAppearance } from './lib/appearance';
import { Appearance } from './screens/Appearance';
import { QuizBuilder } from './screens/QuizBuilder';
import { exampleDeck } from './lib/help';
import { Help } from './screens/Help';
import { Backup } from './screens/Backup';
import { backupPayload, CloudClient, defaultDeviceName, fingerprint } from './lib/cloud';

/** Auto backup waits this long after the last change, so a study session isn't uploaded answer by answer. */
const AUTO_BACKUP_DELAY = 30_000;

type View =
  | { name: 'home' }
  | { name: 'deck'; deckId: string }
  | { name: 'study'; deckId: string; mode: 'review' | 'quiz' }
  | { name: 'test'; deckId: string; quizId: string }
  | { name: 'help'; topic?: string; from: Exclude<View, { name: 'help' }> }
  | { name: 'appearance'; from: View }
  | { name: 'backup' }
  | { name: 'custom-edit'; quiz: CustomQuiz; isNew: boolean }
  | { name: 'custom-test'; quizId: string }
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

  // ---- cloud backup (Google Sheet) ----
  const libRef = useRef(lib);
  libRef.current = lib;
  const [autoError, setAutoError] = useState<string | null>(null);
  const payloadHash = useMemo(() => (lib?.cloud?.url ? fingerprint(backupPayload(lib)) : ''), [lib]);

  const cloudBackup = useCallback(async () => {
    const current = libRef.current;
    const cloud = current?.cloud;
    if (!current || !cloud?.url) throw new Error('Not connected to a Google Sheet');
    const hash = fingerprint(backupPayload(current));
    const info = await new CloudClient(cloud).save(current, cloud.device?.trim() || defaultDeviceName());
    setAutoError(null);
    setLib((l) => (l?.cloud ? { ...l, cloud: { ...l.cloud, lastBackupAt: info.created, lastHash: hash } } : l));
    return info;
  }, []);

  const cloud = lib?.cloud;
  useEffect(() => {
    if (!cloud?.auto || !cloud.url || !payloadHash || payloadHash === cloud.lastHash) return;
    const t = setTimeout(() => {
      cloudBackup().catch((e) => setAutoError((e as Error).message));
    }, AUTO_BACKUP_DELAY);
    return () => clearTimeout(t);
  }, [payloadHash, cloud?.auto, cloud?.url, cloud?.lastHash, cloudBackup]);

  const appearance = normalizeAppearance(lib?.appearance);
  const appearanceKey = JSON.stringify(appearance);
  useEffect(() => {
    if (lib) applyAppearance(appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearanceKey, !!lib]);

  if (!lib) return <div className="loading">Loading…</div>;

  const update = (fn: (l: Library) => Library) => setLib((l) => (l ? fn(l) : l));
  const deck = 'deckId' in view ? lib.decks.find((d) => d.id === view.deckId) : undefined;
  const home = () => setView({ name: 'home' });
  const help = (topic?: string) => setView((v) => (v.name === 'help' ? v : { name: 'help', topic, from: v }));

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

  const recordAnswer = (deckId: string, itemKey: string, grade: Parameters<typeof L.recordAnswer>[3]) =>
    update((l) => L.recordAnswer(l, deckId, itemKey, grade));

  let screen;
  if (view.name === 'backup') {
    screen = (
      <Backup
        library={lib}
        update={update}
        onBackupNow={cloudBackup}
        autoError={autoError}
        onHelp={() => help('backup')}
        onBack={home}
      />
    );
  } else if (view.name === 'appearance') {
    screen = (
      <Appearance
        value={appearance}
        onChange={(change) => update((l) => ({ ...l, appearance: { ...normalizeAppearance(l.appearance), ...change } }))}
        questionTime={defaultQuestionTime(lib)}
        onQuestionTime={(questionTime) => update((l) => ({ ...l, settings: { ...l.settings, questionTime } }))}
        onBack={() => setView(view.from)}
      />
    );
  } else if (view.name === 'custom-edit') {
    screen = (
      <QuizBuilder
        key={view.quiz.id}
        library={lib}
        quiz={view.quiz}
        isNew={view.isNew}
        onHelp={() => help('custom')}
        onCancel={home}
        onSave={(quiz, start) => {
          update((l) => upsertCustomQuiz(l, quiz));
          setView(start ? { name: 'custom-test', quizId: quiz.id } : { name: 'home' });
        }}
      />
    );
  } else if (view.name === 'custom-test') {
    const quiz = lib.customQuizzes?.find((q) => q.id === view.quizId);
    screen = quiz ? (
      <TimedQuiz
        key={quiz.id}
        quiz={quiz}
        pool={customQuizItems(lib, quiz)}
        history={quizAttempts(lib, CUSTOM_QUIZ_OWNER, quiz.id)}
        backLabel="Home"
        ownerId={CUSTOM_QUIZ_OWNER}
        defaultTime={defaultQuestionTime(lib)}
        onRecord={recordAnswer}
        onFinish={(attempt) => update((l) => addAttempt(l, attempt))}
        onExit={home}
      />
    ) : (
      <div className="empty">
        <p>This quiz no longer exists.</p>
        <button type="button" onClick={home}>
          Home
        </button>
      </div>
    );
  } else if (view.name === 'help') {
    screen = (
      <Help
        topic={view.topic}
        onBack={() => setView(view.from)}
        onAddExampleDeck={() => {
          const id = uid('deck-');
          update((l) => L.upsertDeck(l, exampleDeck(id)));
          setView({ name: 'deck', deckId: id });
        }}
      />
    );
  } else if (view.name === 'home' || !deck) {
    screen = (
      <Home
        library={lib}
        onOpen={(deckId) => setView({ name: 'deck', deckId })}
        onStudy={(deckId, mode) => setView({ name: 'study', deckId, mode })}
        onImport={importFile}
        onHelp={help}
        onAppearance={() => setView((v) => ({ name: 'appearance', from: v }))}
        onBackup={() => setView({ name: 'backup' })}
        onNewCustomQuiz={() => setView({ name: 'custom-edit', quiz: newCustomQuiz(), isNew: true })}
        onEditCustomQuiz={(quizId) => {
          const quiz = lib.customQuizzes?.find((q) => q.id === quizId);
          if (quiz) setView({ name: 'custom-edit', quiz, isNew: false });
        }}
        onStartCustomQuiz={(quizId) => setView({ name: 'custom-test', quizId })}
        onDeleteCustomQuiz={(quizId) => update((l) => removeCustomQuiz(l, quizId))}
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
        onHelp={help}
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
        defaultTime={defaultQuestionTime(lib)}
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
        quiz={quiz}
        pool={deckQuizItems(deck, quiz)}
        history={quizAttempts(lib, deck.id, quiz.id)}
        backLabel={deck.title}
        ownerId={deck.id}
        defaultTime={defaultQuestionTime(lib)}
        onRecord={recordAnswer}
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
        defaultTime={defaultQuestionTime(lib)}
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

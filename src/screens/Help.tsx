import { useEffect, useState } from 'react';
import type { Card, CardType } from '../types';
import { CARD_TYPE_LABELS } from '../lib/cardForm';
import { CARD_HELP } from '../lib/help';
import { expandCard, VARIANT_LABELS } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';

interface Props {
  /** Section or card type to open and scroll to, e.g. 'decks' or 'table'. */
  topic?: string;
  onBack: () => void;
  /** Adds a deck with one example of every card type (button hidden when not given). */
  onAddExampleDeck?: () => void;
}

const TYPES = Object.keys(CARD_TYPE_LABELS) as CardType[];

const SECTIONS = [
  ['start', 'Getting started'],
  ['decks', 'Creating a deck'],
  ['cards', 'Adding cards'],
  ['types', 'Card types'],
  ['study', 'Studying'],
  ['timed', 'Timed quizzes'],
  ['custom', 'Custom quizzes'],
  ['appearance', 'Themes & layout'],
  ['files', 'Sharing decks (JSON files)'],
  ['backup', 'Backup & other devices'],
  ['keys', 'Keyboard shortcuts'],
] as const;

/** Live, playable example of a card. Vocabulary entries show one tab per generated question. */
function Example({ card }: { card: Card }) {
  const items = expandCard(card);
  const [i, setI] = useState(0);
  const [round, setRound] = useState(0);
  const shown = items[Math.min(i, items.length - 1)];
  return (
    <div className="help-example">
      <div className="row wrap">
        <span className="sub">Try it:</span>
        {items.length > 1 &&
          items.map((it, k) => (
            <button key={it.key} type="button" className={`chip ${k === i ? 'active' : ''}`} onClick={() => setI(k)}>
              {VARIANT_LABELS[it.variant ?? '']?.replace('Vocabulary · ', '') ?? it.variant}
            </button>
          ))}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={() => setRound((r) => r + 1)}>
          ↺ Reset
        </button>
      </div>
      <CardView
        key={`${shown.key}-${round}`}
        card={shown.card}
        label={shown.variant ? VARIANT_LABELS[shown.variant] : undefined}
        lang="de"
        onAnswer={() => {}}
      />
    </div>
  );
}

export function Help({ topic, onBack, onAddExampleDeck }: Props) {
  const [open, setOpen] = useState<string | null>(TYPES.includes(topic as CardType) ? topic! : null);

  useEffect(() => {
    if (topic) document.getElementById(`help-${topic}`)?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [topic]);

  const go = (id: string) => document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="screen help">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>
          ← Back
        </button>
        <strong>Help</strong>
      </header>

      <nav className="help-toc" aria-label="Help topics">
        {SECTIONS.map(([id, title]) => (
          <button key={id} type="button" className="chip" onClick={() => go(id)}>
            {title}
          </button>
        ))}
      </nav>

      <section id="help-start" className="help-section">
        <h2>Getting started</h2>
        <ol>
          <li>
            On the start screen press <b>+ New deck</b>. A deck is a collection of cards, e.g. "A1 Chapter 3".
          </li>
          <li>
            Give it a name, then press one of the <b>+ Add card</b> buttons and pick a card type.
          </li>
          <li>Fill in the form. The live preview shows the card exactly as learners will see it; you can try it there.</li>
          <li>
            Press <b>Study</b> to learn with spaced repetition, <b>Quiz</b> for a quick random round, or set up a{' '}
            <b>timed quiz</b> to test yourself or a class.
          </li>
        </ol>
        {onAddExampleDeck && (
          <div className="notice">
            Want to see every card type in action first?{' '}
            <button type="button" className="primary" onClick={onAddExampleDeck}>
              Add an example deck
            </button>
          </div>
        )}
      </section>

      <section id="help-decks" className="help-section">
        <h2>Creating a deck</h2>
        <ul>
          <li>
            <b>+ New deck</b> on the start screen creates an empty deck and opens it.
          </li>
          <li>
            Click the title at the top of the deck to rename it, and add a short description underneath.
          </li>
          <li>
            <b>Learning</b> sets the language you are learning (used for read-aloud and the ä ö ü ß buttons).
          </li>
          <li>
            <b>Import</b> on the start screen adds decks from a <code>.quizzo.json</code> file, for example one a
            teacher or friend shared. See <i>Sharing decks</i> below.
          </li>
          <li>
            <b>Export JSON</b> saves the deck as a file you can share. <b>Back up all</b> saves every deck and your
            progress.
          </li>
          <li>
            <b>Reset progress</b> forgets what you have learned in this deck (the cards stay). <b>Delete deck</b>{' '}
            removes the deck and its cards.
          </li>
        </ul>
        <p className="sub">
          Tip: keep decks small and focused (20–60 cards per topic). Use tags to group cards inside a deck.
        </p>
      </section>

      <section id="help-cards" className="help-section">
        <h2>Adding cards</h2>
        <ul>
          <li>
            Open a deck and press one of the <b>+ Add card</b> buttons. Not sure which type? See <i>Card types</i>{' '}
            below.
          </li>
          <li>
            Every card editor shows <b>How to write this card</b> with step-by-step instructions, and a{' '}
            <b>Fill in an example</b> button that shows a finished card you can change.
          </li>
          <li>
            <b>Save &amp; add another</b> keeps the editor open so you can add many cards quickly.
          </li>
          <li>Click a card in the deck's list to edit it; 🗑 deletes it.</li>
        </ul>
        <p>These fields are available on every card type:</p>
        <ul>
          <li>
            <b>Hint</b>: a small clue. Learners see it by pressing <b>💡 Show hint</b> (flashcards show it on the front).
          </li>
          <li>
            <b>Pictures</b>: a <b>question picture</b> shown with the question or instruction, and a <b>hint picture</b>{' '}
            shown with the hint. Paste one with Ctrl+V (pasting while typing the question adds it to the question,
            while typing the hint adds it to the hint), drop a file, or choose one. Pictures are made smaller
            automatically and saved inside the deck, so they are included when you export or back up.
          </li>
          <li>
            <b>Explanation</b>: shown after answering, e.g. the grammar rule. Short explanations help a lot.
          </li>
          <li>
            <b>Tags</b>: comma separated, e.g. <code>A1, verbs</code>. Timed quizzes can be limited to certain tags.
          </li>
          <li>
            <b>Time in quizzes</b>: how many seconds this question gets in a timed quiz. Leave it empty to use the
            default (30 seconds, changeable in <b>⚙ Settings</b>). <b>Study</b> has no clock, so you can take your time
            there.
          </li>
        </ul>
      </section>

      <section id="help-types" className="help-section">
        <h2>Card types</h2>
        <p className="sub">Tap a type to see how to write it and try a working example.</p>
        <div className="help-types">
          {TYPES.map((t) => {
            const h = CARD_HELP[t];
            return (
              <details
                key={t}
                id={`help-${t}`}
                open={open === t}
                onToggle={(e) => {
                  const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                  setOpen((o) => (isOpen ? t : o === t ? null : o));
                }}
              >
                <summary>
                  <span className={`badge badge-${t}`}>{CARD_TYPE_LABELS[t]}</span> {h.summary}
                </summary>
                <div className="help-type-body">
                  <p>
                    <b>Good for:</b> {h.goodFor}
                  </p>
                  <ol>
                    {h.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {open === t && <Example card={h.example} />}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section id="help-study" className="help-section">
        <h2>Studying</h2>
        <ul>
          <li>
            <b>Study</b> uses spaced repetition: cards you know come back less often, cards you miss come back
            sooner. Each session has the cards that are due plus up to 10 new ones. Missed cards repeat once at the
            end.
          </li>
          <li>
            <b>Quiz</b>: 10 random cards from the deck with a score at the end. Each question has a clock (its card's time, or the default from Settings); when it runs out, the question counts as missed.
          </li>
          <li>
            <b>Timed quizzes</b>: tests with a clock; see below.
          </li>
          <li>
            Drag-and-drop cards can always be answered by tapping too: tap a word, then tap where it goes.
          </li>
        </ul>
      </section>

      <section id="help-timed" className="help-section">
        <h2>Timed quizzes</h2>
        <ol>
          <li>
            Open a deck and press <b>+ New timed quiz</b>.
          </li>
          <li>
            Choose a name and the number of questions (leave empty for all cards).
          </li>
          <li>
            Choose the <b>time per question</b>: <i>Each card's own time</i> (the default: every card's time, or 30
            seconds if it has none), <i>Same for every question</i>, or <i>No limit</i>. You can also set a{' '}
            <b>time limit</b> for the whole quiz in minutes; leave it empty for none.
          </li>
          <li>
            Optionally pick <b>card types</b> or <b>tags</b> to test only part of the deck. The line underneath shows
            how many questions match.
          </li>
          <li>
            Press <b>Save quiz</b>, then <b>Start</b>. Each run picks a new random set of questions.
          </li>
        </ol>
        <p>
          When a question's clock runs out it counts as missed and the next one starts. When the quiz clock reaches
          0:00 the quiz ends; unanswered questions count as wrong. At the end you see your
          score, your time and a review of every question. Your recent results are saved. Timed quizzes are saved in
          the deck, so they are included when you export and share it.
        </p>
      </section>

      <section id="help-custom" className="help-section">
        <h2>Custom quizzes (from any deck)</h2>
        <p>A custom quiz is not part of one deck: you pick the questions yourself from all your decks.</p>
        <ol>
          <li>
            On the start screen, under <b>Custom quizzes</b>, press <b>+ New custom quiz</b>.
          </li>
          <li>Give it a name and, if you like, a number of questions and a time limit (leave empty for no limit).</li>
          <li>
            In the <b>Question bank</b>, tick the questions you want. Search, or filter by deck, card type or tag, then
            use <b>Select all shown</b> to add many at once. The tick box next to a deck name selects all its shown
            cards. 👁 shows a preview.
          </li>
          <li>
            Press <b>Save &amp; start</b>, or <b>Save</b> to take it later. If you set a number of questions, each run
            picks that many at random from your selection.
          </li>
        </ol>
        <p className="sub">
          Answers still count towards each card's learning progress in its own deck. ⤓ exports the quiz as a normal
          deck file (with copies of the questions) so you can share it.
        </p>
      </section>

      <section id="help-appearance" className="help-section">
        <h2>Themes &amp; layout</h2>
        <p>
          Press <b>⚙ Settings</b> on the start screen. Changes apply straight away and the preview shows a real
          question you can try.
        </p>
        <ul>
          <li>
            <b>Theme</b>: Match device, Light, Dark, Sepia, Ocean, Forest, Midnight or High contrast.
          </li>
          <li>
            <b>Question placement</b>: <i>Centred</i> puts the question in the middle of the screen with centred text;
            <i> Top, centred</i> keeps it at the top; <i>Top, left</i> is the classic layout.
          </li>
          <li>
            <b>Card style</b>, <b>Font</b> and <b>Text size</b> change how cards look and how big everything is.
          </li>
        </ul>
      </section>

      <section id="help-files" className="help-section">
        <h2>Sharing decks (JSON files)</h2>
        <p>
          A deck is a plain text file ending in <code>.quizzo.json</code>. You can export one, send it to someone, and
          they import it. Your learning progress is not in the file, so shared decks stay clean.
        </p>
        <p>You can also write decks by hand, with a script, or with an AI assistant. A minimal deck looks like this:</p>
        <pre className="help-code">{`{
  "format": "quizzo-deck",
  "version": 1,
  "deck": {
    "title": "My first deck",
    "language": { "target": "de", "native": "en" },
    "cards": [
      { "type": "vocab", "word": "Tisch", "article": "der",
        "plural": "Tische", "meaning": "table" },
      { "type": "cloze", "text": "Ich {{wohne}} in Berlin." }
    ]
  }
}`}</pre>
        <p className="sub">
          Card ids are optional. To see the JSON for any card type, create it in the app and use <b>Export JSON</b>.
          If a card in an imported file is invalid, it is skipped and the app tells you why.
        </p>
      </section>

      <section id="help-backup" className="help-section">
        <h2>Backup &amp; other devices</h2>
        <p>
          Press <b>☁ Backup</b> on the start screen. A backup holds everything: decks, timed and custom quizzes, study
          progress, quiz results and appearance.
        </p>
        <ul>
          <li>
            <b>Google Sheet</b>: backups go into a Google Sheet that belongs to you, so you can restore them on your
            phone or another computer. Set it up once on a computer (Backup screen → "First time"): create a Sheet, paste
            the script Quizzo gives you into <i>Extensions → Apps Script</i>, deploy it as a web app, and paste its link
            into Quizzo.
          </li>
          <li>
            <b>On your phone</b> (or another computer): open Backup, paste the <b>connection link</b> (Copy link on the
            first device, or the "Quizzo" tab of the Sheet), press Connect, then <b>Restore…</b> the newest backup.
          </li>
          <li>
            <b>Back up automatically</b> uploads about half a minute after you change something, while Quizzo is open.
            The Sheet keeps the 20 newest backups.
          </li>
          <li>
            <b>Restore</b> shows when the backup was made (and on which device) next to your last change here. Then
            choose <b>Merge with this device</b> or <b>Replace everything here</b>; both can be undone. Merge keeps
            cards from both sides and the latest learning progress. Cards deleted on one side are removed on the
            other, unless they were edited after the deletion. If a card was changed on both sides, Quizzo shows both
            versions with their times and you pick which one stays (the newer one is preselected).
          </li>
          <li>
            <b>Backup file</b>: the same backup as a single .json file (desktop and browser).
          </li>
        </ul>
        <p className="sub">
          Keep the connection link private: anyone who has it can read and add backups. To stop using a link, delete the
          deployment in Apps Script (Deploy → Manage deployments).
        </p>
      </section>

      <section id="help-keys" className="help-section">
        <h2>Keyboard shortcuts</h2>
        <ul>
          <li>
            <kbd>Space</kbd> reveals a flashcard; <kbd>1</kbd>–<kbd>4</kbd> grade it (Again / Hard / Good / Easy).
          </li>
          <li>
            <kbd>Enter</kbd> goes to the next card.
          </li>
          <li>
            <kbd>Esc</kbd> leaves a study session or quiz.
          </li>
        </ul>
      </section>
    </div>
  );
}

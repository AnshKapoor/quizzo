import { useMemo, useState } from 'react';
import type { Card, CardType, Deck } from '../types';
import { CARD_TYPE_LABELS, cardToForm, emptyForm, formToCard, type CardForm } from '../lib/cardForm';
import { uid } from '../lib/util';
import { expandCard, VARIANT_LABELS } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';
import { CARD_HELP } from '../lib/help';
import { Help } from './Help';

interface Props {
  deck: Deck;
  card?: Card;
  type: CardType;
  /** Seconds a question gets in a quiz when the card doesn't set its own time (from Settings). */
  defaultTime: number;
  onSave: (card: Card, addAnother: boolean) => void;
  onCancel: () => void;
}

export function CardEditor({ deck, card, type, defaultTime, onSave, onCancel }: Props) {
  const [form, setForm] = useState<CardForm>(() => (card ? cardToForm(card) : emptyForm(type)));
  const [id, setId] = useState(() => card?.id ?? uid('c-'));
  const result = useMemo(() => formToCard(form, id), [form, id]);
  // Preview: vocabulary entries show one tab per generated question.
  const previewDeck = useMemo(
    () => (result.card ? { ...deck, cards: [...deck.cards.filter((c) => c.id !== id), result.card] } : deck),
    [deck, result.card, id],
  );
  const previewItems = useMemo(
    () => (result.card ? expandCard(result.card, previewDeck) : []),
    [result.card, previewDeck],
  );
  const [variant, setVariant] = useState(0);
  const shownIndex = Math.min(variant, Math.max(0, previewItems.length - 1));
  const shown = previewItems[shownIndex];

  const set = <K extends keyof CardForm>(k: K, v: CardForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const text = (k: keyof CardForm, label: string, opts: { rows?: number; placeholder?: string; help?: string } = {}) => (
    <label className="field">
      <span>{label}</span>
      {opts.rows ? (
        <textarea
          rows={opts.rows}
          value={form[k] as string}
          placeholder={opts.placeholder}
          onChange={(e) => set(k, e.target.value)}
        />
      ) : (
        <input value={form[k] as string} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
      )}
      {opts.help && <small>{opts.help}</small>}
    </label>
  );

  const check = (k: 'shuffle' | 'caseSensitive' | 'wordBank', label: string) => (
    <label className="check">
      <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );

  /** Help is shown in place of the editor, so what has been typed is kept. */
  const [helpTopic, setHelpTopic] = useState<string | null>(null);
  const help = CARD_HELP[form.type];
  const isEmpty = JSON.stringify(form) === JSON.stringify(emptyForm(form.type));
  const fillExample = () => {
    if (isEmpty || confirm('Replace what you have typed with the example?')) setForm(cardToForm(help.example));
  };

  const save = (another: boolean) => {
    if (result.card) {
      onSave(result.card, another);
      if (another) {
        setForm(emptyForm(form.type));
        setId(uid('c-'));
      }
    }
  };

  if (helpTopic) return <Help topic={helpTopic} onBack={() => setHelpTopic(null)} />;

  return (
    <div className="screen editor">
      <header className="bar">
        <button type="button" className="ghost" onClick={onCancel}>
          ← {deck.title}
        </button>
        <strong>{card ? 'Edit card' : 'New card'}</strong>
      </header>

      <div className="editor-grid">
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <label className="field">
            <span>Card type</span>
            <select
              value={form.type}
              disabled={!!card}
              onChange={(e) => setForm({ ...emptyForm(e.target.value as CardType) })}
            >
              {Object.entries(CARD_TYPE_LABELS).map(([t, l]) => (
                <option key={t} value={t}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <details className="help-box" open={!card}>
            <summary>How to write a {CARD_TYPE_LABELS[form.type].toLowerCase()} card</summary>
            <p>{help.summary}</p>
            <p className="sub">Good for: {help.goodFor}</p>
            <ol>
              {help.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="row wrap">
              <button type="button" onClick={fillExample}>
                Fill in an example
              </button>
              <button type="button" className="ghost" onClick={() => setHelpTopic(form.type)}>
                More help
              </button>
            </div>
          </details>

          {form.type === 'flashcard' && (
            <>
              {text('front', 'Front (German)', { placeholder: 'der Hund' })}
              {text('back', 'Back (meaning)', { placeholder: 'the dog' })}
              {text('example', 'Example sentence', { placeholder: 'Der Hund schläft.' })}
            </>
          )}

          {form.type === 'mcq' && (
            <>
              {text('prompt', 'Question', { placeholder: '___ Mädchen' })}
              {text('options', 'Options', {
                rows: 5,
                placeholder: 'der\ndie\n*das',
                help: 'One per line. Start correct options with * (several * = select all that apply).',
              })}
              {check('shuffle', 'Shuffle options')}
            </>
          )}

          {form.type === 'match' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Match the colours' })}
              {text('pairs', 'Pairs', { rows: 6, placeholder: 'rot = red\nblau = blue', help: 'One pair per line: left = right' })}
            </>
          )}

          {form.type === 'cloze' && (
            <>
              {text('text', 'Sentence', {
                rows: 3,
                placeholder: 'Ich {{heiße::heißen}} Anna.',
                help: 'Wrap blanks in {{ }}. Alternatives: {{schön|gut}}. Hint: {{heiße::heißen}}.',
              })}
              {text('translation', 'Translation')}
              {check('caseSensitive', 'Capitalisation must match (useful for nouns)')}
              {check('wordBank', 'Word bank: pick words instead of typing')}
              {form.wordBank &&
                text('distractors', 'Extra wrong words for the bank', {
                  placeholder: 'der, den, des',
                  help: 'Comma separated. The correct answers are added automatically.',
                })}
            </>
          )}

          {form.type === 'categorize' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Sort by article' })}
              {text('groups', 'Groups', {
                rows: 5,
                placeholder: 'der: Tisch, Löffel\ndie: Lampe, Gabel\ndas: Buch, Messer',
                help: 'One group per line: name: item, item, item',
              })}
            </>
          )}

          {form.type === 'spot' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Find the mistake' })}
              {text('text', 'Sentence with mistake(s)', {
                rows: 2,
                placeholder: 'Ich [[habe|bin]] gestern nach Berlin gefahren.',
                help: 'Mark each mistake as [[wrong|correction]].',
              })}
              {text('translation', 'Translation')}
            </>
          )}

          {form.type === 'dictation' && (
            <>
              {text('text', 'Sentence to read aloud', { rows: 2, placeholder: 'Ich wohne in Berlin.' })}
              {text('translation', 'Translation (shown after answering)')}
              {check('caseSensitive', 'Capitalisation must match')}
            </>
          )}

          {form.type === 'vocab' && (
            <>
              <div className="row wrap">
                <label className="field">
                  <span>Article</span>
                  <select value={form.article} onChange={(e) => set('article', e.target.value as CardForm['article'])}>
                    <option value="">(none)</option>
                    <option value="der">der</option>
                    <option value="die">die</option>
                    <option value="das">das</option>
                  </select>
                </label>
                <div style={{ flex: 1 }}>{text('word', 'Word', { placeholder: 'Tisch' })}</div>
              </div>
              {text('plural', 'Plural (without "die")', { placeholder: 'Tische' })}
              {text('meaning', 'Meaning', { placeholder: 'table' })}
              {text('example', 'Example sentence', { placeholder: 'Der Tisch ist neu.' })}
              <small className="sub">
                Creates up to 5 questions: German → English, English → German, article, plural, and the meaning as
                multiple choice (once the deck has 4+ vocabulary entries).
              </small>
            </>
          )}

          {form.type === 'order' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Build the sentence' })}
              {text('tokens', 'Correct sentence', {
                placeholder: 'Morgen fahre ich nach Berlin.',
                help: 'Split into words by spaces, or use | to keep chunks together: Ich | habe | Fußball gespielt',
              })}
              {text('accept', 'Other correct orders', { rows: 2, help: 'Optional, one sentence per line.' })}
              {text('translation', 'Translation')}
            </>
          )}

          {form.type === 'sequence' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Put the conversation in order' })}
              {text('items', 'Lines in the correct order', {
                rows: 6,
                placeholder: 'Guten Tag!\nGuten Tag. Was möchten Sie?\nEinen Kaffee, bitte.\nGern. Das macht 2,50 €.',
                help: 'One per line, top to bottom. They are shuffled when studying.',
              })}
            </>
          )}

          {form.type === 'table' && (
            <>
              {text('prompt', 'Instruction', { placeholder: 'Conjugate sein and haben' })}
              {text('table', 'Table', {
                rows: 7,
                placeholder: 'Person | sein | haben\nich | bin | habe\ndu | bist | hast\ner/sie/es | ist | hat',
                help: 'First line = column headers. Then one row per line, cells separated by |. The first cell of each row is shown; the others are dragged in.',
              })}
              {text('distractors', 'Extra wrong words for the bank', {
                placeholder: 'seid, habt',
                help: 'Optional, comma separated.',
              })}
            </>
          )}

          {text('hint', 'Hint (optional)')}
          {text('explanation', 'Explanation shown after answering (optional)', { rows: 2 })}
          {text('tags', 'Tags', { placeholder: 'A1, verbs' })}
          <label className="field time-field">
            <span>Time in quizzes (seconds)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={form.time}
              placeholder={`${defaultTime} (default)`}
              onChange={(e) => set('time', e.target.value)}
            />
            <small>
              How long this question gets in the deck Quiz and in timed quizzes. Leave empty to use the default ({defaultTime} s), which you can
              change in Settings. Study (review) has no clock.
            </small>
          </label>

          {result.error && <p className="error">⚠ {result.error}</p>}
          <div className="row">
            <button type="submit" className="primary" disabled={!result.card}>
              Save
            </button>
            {!card && (
              <button type="button" disabled={!result.card} onClick={() => save(true)}>
                Save & add another
              </button>
            )}
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <aside className="preview">
          <div className="sub">Live preview — try it</div>
          {previewItems.length > 1 && (
            <div className="row wrap">
              {previewItems.map((it, i) => (
                <button
                  key={it.key}
                  type="button"
                  className={`chip ${i === shownIndex ? 'active' : ''}`}
                  onClick={() => setVariant(i)}
                >
                  {VARIANT_LABELS[it.variant ?? '']?.replace('Vocabulary · ', '') ?? it.variant}
                </button>
              ))}
            </div>
          )}
          {shown ? (
            <CardView
              key={JSON.stringify(shown.card)}
              card={shown.card}
              label={shown.variant ? VARIANT_LABELS[shown.variant] : undefined}
              lang={deck.language.target}
              onAnswer={() => {}}
            />
          ) : (
            <div className="card placeholder">Fill in the form to see the card.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

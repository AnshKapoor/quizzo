// Maps cards to/from simple text fields so every card type can be edited with plain inputs.
import type { Card, CardType } from '../types';
import { validateCard } from './validate';

export interface CardForm {
  type: CardType;
  front: string;
  back: string;
  example: string;
  prompt: string;
  /** One option per line, correct ones start with "*". */
  options: string;
  shuffle: boolean;
  /** One pair per line: "left = right". */
  pairs: string;
  /** Cloze / spot / dictation text. */
  text: string;
  translation: string;
  caseSensitive: boolean;
  wordBank: boolean;
  /** Comma separated. */
  distractors: string;
  /** Words separated by spaces, or by "|" when a chunk contains spaces. */
  tokens: string;
  /** One alternative correct sentence per line. */
  accept: string;
  /** One group per line: "der: Tisch, Hund". */
  groups: string;
  /** Sequence: one item per line, in the correct order. */
  items: string;
  /** Table: one row per line, cells separated by "|"; the first line holds the headers. */
  table: string;
  word: string;
  article: '' | 'der' | 'die' | 'das';
  plural: string;
  meaning: string;
  hint: string;
  explanation: string;
  /** Comma separated. */
  tags: string;
}

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  vocab: 'Vocabulary',
  flashcard: 'Flashcard',
  mcq: 'Multiple choice',
  match: 'Match the following',
  cloze: 'Complete the sentence',
  order: 'Word order',
  categorize: 'Sort into groups',
  spot: 'Find the mistake',
  dictation: 'Dictation',
  sequence: 'Sequence',
  table: 'Fill the table',
};

export function emptyForm(type: CardType): CardForm {
  return {
    type,
    front: '',
    back: '',
    example: '',
    prompt: '',
    options: '',
    shuffle: true,
    pairs: '',
    text: '',
    translation: '',
    caseSensitive: false,
    wordBank: false,
    distractors: '',
    tokens: '',
    accept: '',
    groups: '',
    items: '',
    table: '',
    word: '',
    article: '',
    plural: '',
    meaning: '',
    hint: '',
    explanation: '',
    tags: '',
  };
}

export function cardToForm(card: Card): CardForm {
  const f = emptyForm(card.type);
  f.hint = card.hint ?? '';
  f.explanation = card.explanation ?? '';
  f.tags = (card.tags ?? []).join(', ');
  switch (card.type) {
    case 'flashcard':
      Object.assign(f, { front: card.front, back: card.back, example: card.example ?? '' });
      break;
    case 'mcq':
      f.prompt = card.prompt;
      f.options = card.options.map((o, i) => (card.answer.includes(i) ? '*' : '') + o).join('\n');
      f.shuffle = card.shuffle !== false;
      break;
    case 'match':
      f.prompt = card.prompt ?? '';
      f.pairs = card.pairs.map((p) => `${p.left} = ${p.right}`).join('\n');
      break;
    case 'cloze':
      Object.assign(f, {
        text: card.text,
        translation: card.translation ?? '',
        caseSensitive: !!card.caseSensitive,
        wordBank: !!card.wordBank,
        distractors: (card.distractors ?? []).join(', '),
      });
      break;
    case 'order':
      f.prompt = card.prompt ?? '';
      f.tokens = card.tokens.some((t) => t.includes(' ')) ? card.tokens.join(' | ') : card.tokens.join(' ');
      f.accept = (card.accept ?? []).join('\n');
      f.translation = card.translation ?? '';
      break;
    case 'categorize':
      f.prompt = card.prompt ?? '';
      f.groups = card.groups.map((g) => `${g.name}: ${g.items.join(', ')}`).join('\n');
      break;
    case 'spot':
      Object.assign(f, { prompt: card.prompt ?? '', text: card.text, translation: card.translation ?? '' });
      break;
    case 'dictation':
      Object.assign(f, { text: card.text, translation: card.translation ?? '', caseSensitive: !!card.caseSensitive });
      break;
    case 'sequence':
      f.prompt = card.prompt ?? '';
      f.items = card.items.join('\n');
      break;
    case 'table':
      f.prompt = card.prompt ?? '';
      f.table = [card.columns, ...card.rows].map((r) => r.join(' | ')).join('\n');
      f.distractors = (card.distractors ?? []).join(', ');
      break;
    case 'vocab':
      Object.assign(f, {
        word: card.word,
        article: card.article ?? '',
        plural: card.plural ?? '',
        meaning: card.meaning,
        example: card.example ?? '',
      });
      break;
  }
  return f;
}

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const list = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);
const opt = (s: string) => (s.trim() ? s.trim() : undefined);

export function formToCard(f: CardForm, id: string): { card?: Card; error?: string } {
  const tags = list(f.tags);
  const base = { id, hint: opt(f.hint), explanation: opt(f.explanation), tags: tags.length ? tags : undefined };

  let card: Card;
  switch (f.type) {
    case 'flashcard':
      card = { ...base, type: 'flashcard', front: f.front.trim(), back: f.back.trim(), example: opt(f.example) };
      break;
    case 'mcq': {
      const raw = lines(f.options);
      card = {
        ...base,
        type: 'mcq',
        prompt: f.prompt.trim(),
        options: raw.map((o) => o.replace(/^\*\s*/, '')),
        answer: raw.flatMap((o, i) => (o.startsWith('*') ? [i] : [])),
        shuffle: f.shuffle ? undefined : false,
      };
      break;
    }
    case 'match':
      card = {
        ...base,
        type: 'match',
        prompt: opt(f.prompt),
        pairs: lines(f.pairs).map((l) => {
          const at = l.indexOf('=');
          return at < 0 ? { left: l, right: '' } : { left: l.slice(0, at).trim(), right: l.slice(at + 1).trim() };
        }),
      };
      break;
    case 'cloze': {
      const distractors = list(f.distractors);
      card = {
        ...base,
        type: 'cloze',
        text: f.text.trim(),
        translation: opt(f.translation),
        caseSensitive: f.caseSensitive || undefined,
        wordBank: f.wordBank || undefined,
        distractors: f.wordBank && distractors.length ? distractors : undefined,
      };
      break;
    }
    case 'order': {
      const t = f.tokens.trim();
      const accept = lines(f.accept);
      card = {
        ...base,
        type: 'order',
        prompt: opt(f.prompt),
        tokens: (t.includes('|') ? t.split('|') : t.split(/\s+/)).map((s) => s.trim()).filter(Boolean),
        accept: accept.length ? accept : undefined,
        translation: opt(f.translation),
      };
      break;
    }
    case 'categorize':
      card = {
        ...base,
        type: 'categorize',
        prompt: opt(f.prompt),
        groups: lines(f.groups).map((l) => {
          const at = l.indexOf(':');
          return at < 0 ? { name: l, items: [] } : { name: l.slice(0, at).trim(), items: list(l.slice(at + 1)) };
        }),
      };
      break;
    case 'spot':
      card = { ...base, type: 'spot', prompt: opt(f.prompt), text: f.text.trim(), translation: opt(f.translation) };
      break;
    case 'dictation':
      card = {
        ...base,
        type: 'dictation',
        text: f.text.trim(),
        translation: opt(f.translation),
        caseSensitive: f.caseSensitive || undefined,
      };
      break;
    case 'sequence':
      card = { ...base, type: 'sequence', prompt: opt(f.prompt), items: lines(f.items) };
      break;
    case 'table': {
      const [columns = [], ...rows] = lines(f.table).map((l) => l.split('|').map((c) => c.trim()));
      const distractors = list(f.distractors);
      card = {
        ...base,
        type: 'table',
        prompt: opt(f.prompt),
        columns,
        rows,
        distractors: distractors.length ? distractors : undefined,
      };
      break;
    }
    case 'vocab':
      card = {
        ...base,
        type: 'vocab',
        word: f.word.trim(),
        article: f.article || undefined,
        plural: opt(f.plural),
        meaning: f.meaning.trim(),
        example: opt(f.example),
      };
      break;
  }
  // Drop undefined keys so exported JSON stays tidy.
  const clean = JSON.parse(JSON.stringify(card)) as Card;
  const error = validateCard(clean);
  return error ? { error } : { card: clean };
}

export function cardSummary(card: Card): string {
  switch (card.type) {
    case 'flashcard':
      return `${card.front} → ${card.back}`;
    case 'mcq':
      return card.prompt;
    case 'match':
      return card.prompt || card.pairs.map((p) => p.left).join(', ');
    case 'cloze':
      return card.text.replace(/\{\{(.+?)\}\}/g, (_, a: string) => `[${a.split('::')[0].split('|')[0]}]`);
    case 'order':
      return card.tokens.join(' ');
    case 'categorize':
      return card.prompt || card.groups.map((g) => g.name).join(' / ');
    case 'spot':
      return card.text.replace(/\[\[(.+?)\|.*?\]\]/g, '[$1]');
    case 'dictation':
      return card.text;
    case 'sequence':
      return card.prompt || card.items.join(' → ');
    case 'table':
      return card.prompt || card.columns.join(' / ');
    case 'vocab':
      return `${card.article ? card.article + ' ' : ''}${card.word}${card.plural ? `, die ${card.plural}` : ''} → ${card.meaning}`;
  }
}

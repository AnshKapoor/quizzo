import type { Card, CardType, Deck, QuizPreset } from '../types';
import { blankCount } from './cloze';
import { parseSpot } from './spot';
import { uid } from './util';
import { isImageSource } from './image';

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Returns an error message, or null when the card is valid. */
export function validateCard(c: any): string | null {
  if (!c || typeof c !== 'object') return 'not an object';
  if (c.time !== undefined && !(typeof c.time === 'number' && Number.isFinite(c.time) && c.time > 0))
    return '"time" must be a number of seconds above 0';
  if (c.updatedAt !== undefined && !(typeof c.updatedAt === 'number' && Number.isFinite(c.updatedAt)))
    return '"updatedAt" must be a time (epoch milliseconds)';
  for (const k of ['image', 'hintImage'] as const)
    if (c[k] !== undefined && !isImageSource(c[k])) return `"${k}" must be a picture (data:image/… or an https link)`;
  switch (c.type) {
    case 'flashcard':
      if (!isStr(c.front) || !isStr(c.back)) return 'flashcard needs "front" and "back"';
      return null;
    case 'mcq':
      if (!isStr(c.prompt)) return 'mcq needs "prompt"';
      if (!isStrArr(c.options) || c.options.length < 2) return 'mcq needs at least 2 "options"';
      if (!Array.isArray(c.answer) || c.answer.length === 0) return 'mcq needs "answer" (list of option indexes)';
      if (!c.answer.every((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < c.options.length))
        return 'mcq "answer" index out of range';
      return null;
    case 'match':
      if (!Array.isArray(c.pairs) || c.pairs.length < 2) return 'match needs at least 2 "pairs"';
      if (!c.pairs.every((p: any) => isStr(p?.left) && isStr(p?.right))) return 'every pair needs "left" and "right"';
      return null;
    case 'cloze':
      if (!isStr(c.text)) return 'cloze needs "text"';
      if (blankCount(c.text) === 0) return 'cloze text needs at least one {{blank}}';
      if (c.distractors !== undefined && !isStrArr(c.distractors)) return 'cloze "distractors" must be a list of words';
      return null;
    case 'categorize':
      if (!Array.isArray(c.groups) || c.groups.length < 2) return 'categorize needs at least 2 "groups"';
      if (!c.groups.every((g: any) => isStr(g?.name) && isStrArr(g?.items) && g.items.length > 0))
        return 'every group needs a "name" and at least one item';
      return null;
    case 'spot':
      if (!isStr(c.text)) return 'spot needs "text"';
      if (!parseSpot(c.text).some((t) => t.correction !== undefined)) return 'spot text needs a [[wrong|right]] mistake';
      return null;
    case 'dictation':
      if (!isStr(c.text)) return 'dictation needs "text"';
      return null;
    case 'vocab':
      if (!isStr(c.word) || !isStr(c.meaning)) return 'vocab needs "word" and "meaning"';
      if (c.article !== undefined && !['der', 'die', 'das'].includes(c.article)) return 'vocab "article" must be der, die or das';
      return null;
    case 'order':
      if (!isStrArr(c.tokens) || c.tokens.length < 2) return 'order needs at least 2 "tokens"';
      if (c.accept !== undefined && !isStrArr(c.accept)) return 'order "accept" must be a list of sentences';
      return null;
    case 'sequence':
      if (!isStrArr(c.items) || c.items.filter((x: string) => x.trim()).length < 2)
        return 'sequence needs at least 2 "items" (in the correct order)';
      return null;
    case 'table': {
      if (!isStrArr(c.columns) || c.columns.length < 2) return 'table needs at least 2 "columns" (headers)';
      if (!Array.isArray(c.rows) || c.rows.length === 0) return 'table needs at least one row';
      const bad = c.rows.findIndex((r: unknown) => !isStrArr(r) || r.length !== c.columns.length || !r.every(isStr));
      if (bad >= 0) return `table row ${bad + 1} needs ${c.columns.length} filled cells (one per column)`;
      if (c.distractors !== undefined && !isStrArr(c.distractors)) return 'table "distractors" must be a list of words';
      return null;
    }
    default:
      return `unknown card type "${c.type}"`;
  }
}

/** Validates and normalises a deck; fills in missing ids. Invalid cards are dropped and reported. */
export function validateDeck(d: any): { deck?: Deck; errors: string[] } {
  const errors: string[] = [];
  if (!d || typeof d !== 'object') return { errors: ['deck is not an object'] };
  if (!isStr(d.title)) errors.push('deck needs a "title"');
  if (!Array.isArray(d.cards)) errors.push('deck needs a "cards" list');
  if (errors.length) return { errors };

  const seen = new Set<string>();
  const cards: Card[] = [];
  d.cards.forEach((c: any, i: number) => {
    const err = validateCard(c);
    if (err) {
      errors.push(`card #${i + 1}${c?.id ? ` (${c.id})` : ''}: ${err}`);
      return;
    }
    let id = isStr(c.id) ? c.id : uid('c-');
    while (seen.has(id)) id = uid('c-');
    seen.add(id);
    cards.push({ ...c, id });
  });

  return {
    deck: {
      id: isStr(d.id) ? d.id : uid('deck-'),
      title: d.title,
      description: typeof d.description === 'string' ? d.description : undefined,
      language: {
        target: isStr(d.language?.target) ? d.language.target : 'de',
        native: isStr(d.language?.native) ? d.language.native : 'en',
      },
      tags: isStrArr(d.tags) ? d.tags : undefined,
      cards,
      quizzes: validateQuizzes(d.quizzes, errors),
    },
    errors,
  };
}

export const CARD_TYPES: CardType[] = [
  'vocab', 'flashcard', 'mcq', 'match', 'cloze', 'order', 'categorize', 'spot', 'dictation', 'sequence', 'table',
];

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** Keeps the well-formed timed quizzes of a deck; drops (and reports) the rest. */
function validateQuizzes(raw: unknown, errors: string[]): QuizPreset[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: QuizPreset[] = [];
  raw.forEach((q: any, i) => {
    if (!q || typeof q !== 'object' || !isStr(q.title)) {
      errors.push(`timed quiz #${i + 1}: needs a "title"`);
      return;
    }
    const types = isStrArr(q.types) ? (q.types.filter((t: string) => CARD_TYPES.includes(t as CardType)) as CardType[]) : [];
    const tags = isStrArr(q.tags) ? q.tags.filter(isStr) : [];
    let id = isStr(q.id) ? q.id : uid('q-');
    while (out.some((x) => x.id === id)) id = uid('q-');
    out.push({
      id,
      title: q.title,
      questions: count(q.questions),
      timeLimit: count(q.timeLimit),
      perQuestion: count(q.perQuestion),
      ...(q.cardTimes === true ? { cardTimes: true } : {}),
      ...(types.length ? { types } : {}),
      ...(tags.length ? { tags } : {}),
    });
  });
  return out.length ? out : undefined;
}

/**
 * Accepts any of: a deck file {format:'quizzo-deck', deck}, a bare deck {title, cards},
 * or a full library export {format:'quizzo-library', decks}.
 */
export function parseImport(json: string): { decks: Deck[]; errors: string[] } {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { decks: [], errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const raw: any[] = Array.isArray(data?.decks) ? data.decks : data?.deck ? [data.deck] : [data];
  const decks: Deck[] = [];
  const errors: string[] = [];
  raw.forEach((d, i) => {
    const r = validateDeck(d);
    const label = raw.length > 1 ? `Deck ${i + 1}: ` : '';
    errors.push(...r.errors.map((e) => label + e));
    if (r.deck) decks.push(r.deck);
  });
  return { decks, errors };
}

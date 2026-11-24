// Typed-answer checking tuned for German: tolerant of spacing, trailing punctuation and
// ae/oe/ue/ss spellings for ä/ö/ü/ß, optionally strict about capitalisation (nouns!).

const FOLD: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ẞ: 'SS' };

export function normalize(s: string, caseSensitive = false): string {
  let t = s
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '');
  if (!caseSensitive) t = t.toLocaleLowerCase('de');
  return t;
}

export function foldUmlauts(s: string): string {
  return s.replace(/[äöüßÄÖÜẞ]/g, (c) => FOLD[c]);
}

/** exact = right; umlaut = right but typed ae/oe/ue/ss; case = only capitalisation wrong; wrong = wrong. */
export type AnswerQuality = 'exact' | 'umlaut' | 'case' | 'wrong';

export function checkTyped(input: string, accepted: string[], caseSensitive = false): AnswerQuality {
  if (!input.trim()) return 'wrong';
  const n = normalize(input, caseSensitive);
  const acc = accepted.map((a) => normalize(a, caseSensitive));
  if (acc.includes(n)) return 'exact';
  if (acc.map(foldUmlauts).includes(foldUmlauts(n))) return 'umlaut';
  if (caseSensitive && checkTyped(input, accepted, false) !== 'wrong') return 'case';
  return 'wrong';
}

export const isAccepted = (q: AnswerQuality) => q === 'exact' || q === 'umlaut';

const cleanSentence = (s: string) =>
  s
    .normalize('NFC')
    .toLocaleLowerCase('de')
    .replace(/[.,!?;:"„“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Sentence comparison for word-order cards: ignores case and punctuation. */
export function sameSentence(a: string, b: string): boolean {
  return cleanSentence(a) === cleanSentence(b);
}

/**
 * Which tokens of an attempt sit in the right place? A token may hold several words (e.g. "seinen Weg"),
 * so the target is compared word by word and each token is right when all of its words are in place,
 * ignoring case and punctuation. Used to mark the misplaced tokens in a long sentence.
 */
export function wordPlacement(target: string, attempt: string[]): boolean[] {
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  const t = words(target);
  let pos = 0;
  return attempt.map((token) => {
    const w = words(token);
    const ok = w.every((word, j) => pos + j < t.length && cleanSentence(word) === cleanSentence(t[pos + j]));
    pos += w.length;
    return ok;
  });
}

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

/** Sentence comparison for word-order cards: ignores case and punctuation. */
export function sameSentence(a: string, b: string): boolean {
  const clean = (s: string) =>
    s
      .normalize('NFC')
      .toLocaleLowerCase('de')
      .replace(/[.,!?;:"„“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return clean(a) === clean(b);
}

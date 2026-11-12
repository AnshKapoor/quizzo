// Parser for "find the mistake" text: words separated by spaces, mistakes written [[wrong|correction]].

export interface SpotToken {
  text: string;
  /** Present when this token is a mistake. */
  correction?: string;
}

export function parseSpot(text: string): SpotToken[] {
  const tokens: SpotToken[] = [];
  for (const part of text.split(/(\[\[.+?\]\])/)) {
    const m = part.match(/^\[\[(.+?)\]\]$/);
    if (m) {
      const [wrong, correction = ''] = m[1].split('|');
      tokens.push({ text: wrong.trim(), correction: correction.trim() });
    } else {
      for (const w of part.split(/\s+/)) if (w) tokens.push({ text: w });
    }
  }
  return tokens;
}

/** Punctuation right after a mistake (e.g. "[[gegeht|gegangen]].") sticks to the previous token when shown. */
export function correctedSentence(tokens: SpotToken[]): string {
  return tokens
    .map((t) => (t.correction !== undefined ? t.correction : t.text))
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1');
}

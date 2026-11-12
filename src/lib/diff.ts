// Word-level comparison for dictation: which words of the target sentence did the learner get?
import { foldUmlauts } from './answer';

export const words = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[.,!?;:"„“”]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export interface WordResult {
  word: string;
  /** exact, umlaut (typed ae/oe/ue/ss), missed (wrong or left out). */
  status: 'exact' | 'umlaut' | 'missed';
}

/** Longest-common-subsequence match of the attempt against the target, word by word. */
export function compareWords(target: string, attempt: string, caseSensitive = false): WordResult[] {
  const t = words(target);
  const a = words(attempt);
  const key = (w: string, fold: boolean) => {
    const c = caseSensitive ? w : w.toLocaleLowerCase('de');
    return fold ? foldUmlauts(c) : c;
  };
  const same = (x: string, y: string) => key(x, true) === key(y, true);

  // dp[i][j] = LCS length of t[i..] and a[j..]
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(a.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      dp[i][j] = same(t[i], a[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: WordResult[] = [];
  let i = 0;
  let j = 0;
  while (i < t.length) {
    if (j < a.length && same(t[i], a[j])) {
      out.push({ word: t[i], status: key(t[i], false) === key(a[j], false) ? 'exact' : 'umlaut' });
      i++;
      j++;
    } else if (j < a.length && dp[i][j + 1] >= dp[i + 1][j]) {
      j++; // extra word typed by the learner
    } else {
      out.push({ word: t[i], status: 'missed' });
      i++;
    }
  }
  return out;
}

/** Correct when every target word was matched and nothing extra was typed. */
export function dictationCorrect(target: string, attempt: string, caseSensitive = false): boolean {
  const r = compareWords(target, attempt, caseSensitive);
  return r.every((w) => w.status !== 'missed') && words(attempt).length === words(target).length;
}

export function uid(prefix = ''): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return prefix + id;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle 0..n-1, avoiding the original order when there is more than one item. */
export function shuffleIndexes(n: number): number[] {
  const original = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return original;
  let s = shuffle(original);
  for (let tries = 0; tries < 5 && s.every((v, i) => v === i); tries++) s = shuffle(original);
  return s;
}

/** Copy of `items` with the element at `from` moved to index `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const a = items.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

/** Short, stable fingerprint of a text (auto-backup change detection, picture names). */
export function fingerprint(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `${text.length.toString(36)}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}


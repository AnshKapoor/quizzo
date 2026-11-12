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

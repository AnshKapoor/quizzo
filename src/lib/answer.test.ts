import { describe, expect, it } from 'vitest';
import { wordPlacement } from './answer';

describe('wordPlacement', () => {
  const target = 'Obwohl er schwer keuchte, setzte er seinen Weg fort.';

  it('marks every token right when a multi-word token is in place', () => {
    const attempt = ['Obwohl', 'er', 'schwer', 'keuchte,', 'setzte', 'er', 'seinen Weg', 'fort.'];
    expect(wordPlacement(target, attempt).every(Boolean)).toBe(true);
  });

  it('marks only the misplaced tokens', () => {
    const attempt = ['Obwohl', 'er', 'schwer', 'setzte', 'keuchte,', 'er', 'seinen Weg', 'fort.'];
    expect(wordPlacement(target, attempt)).toEqual([true, true, true, false, false, true, true, true]);
  });
});

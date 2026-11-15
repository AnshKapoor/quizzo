// Smooth moves for word tiles ("FLIP": first, last, invert, play). Every tile carries data-flip="<key>";
// when the same key shows up somewhere else after a change (pool → sentence, back, or neighbours closing a
// gap), the tile glides from where it was instead of jumping. Hidden placeholders (.used) are ignored.
import { useEffect, useLayoutEffect, useRef } from 'react';

const DURATION = 240;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useFlip<T extends HTMLElement>(deps: unknown[]) {
  const root = useRef<T>(null);
  const last = useRef(new Map<string, DOMRect>());
  /** Keys that were just dropped by dragging: they are already where the finger let go, so no glide. */
  const skip = useRef(new Set<string>());

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const now = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((tile) => {
      if (tile.classList.contains('used')) return;
      const r = tile.getBoundingClientRect();
      // Relative to the card, so scrolling between changes doesn't count as movement.
      now.set(tile.dataset.flip!, new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height));
      const before = last.current.get(tile.dataset.flip!);
      if (!before || skip.current.has(tile.dataset.flip!) || reducedMotion() || typeof tile.animate !== 'function') return;
      const dx = before.left - (r.left - base.left);
      const dy = before.top - (r.top - base.top);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      tile.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: DURATION,
        easing: EASING,
      });
    });
    last.current = now;
    skip.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // A pool that stays in view while the text scrolls (the word bank) moves relative to the card,
  // so take the "before" positions afresh when a tap, drag or key press begins.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const remeasure = () => {
      const base = el.getBoundingClientRect();
      el.querySelectorAll<HTMLElement>('[data-flip]').forEach((tile) => {
        // Tiles in mid-glide are not where they will end up; leave those as they were.
        if (tile.classList.contains('used') || tile.getAnimations?.().length) return;
        const r = tile.getBoundingClientRect();
        last.current.set(tile.dataset.flip!, new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height));
      });
    };
    el.addEventListener('pointerdown', remeasure, { capture: true });
    el.addEventListener('keydown', remeasure, { capture: true });
    return () => {
      el.removeEventListener('pointerdown', remeasure, { capture: true });
      el.removeEventListener('keydown', remeasure, { capture: true });
    };
  }, []);

  return { ref: root, skipNext: (key: string | number) => skip.current.add(String(key)) };
}

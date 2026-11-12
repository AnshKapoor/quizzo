// Minimal drag and drop on pointer events, so it works with mouse and touch (Android WebView
// has no reliable HTML5 drag and drop). Drop targets are elements with a data-drop="<zone id>".
// A press that doesn't move is left alone, so tap-to-select keeps working as a fallback.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const THRESHOLD = 6;

export function useDragDrop<T>(onDrop: (item: T, zone: string) => void) {
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  return function startDrag(e: ReactPointerEvent<HTMLElement>, item: T) {
    if (e.button !== 0) return;
    const source = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost: HTMLElement | null = null;
    let hover: HTMLElement | null = null;

    const zoneAt = (x: number, y: number) =>
      (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null) ?? null;

    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
        const rect = source.getBoundingClientRect();
        ghost = source.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        source.classList.add('dragging');
      }
      ev.preventDefault();
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
      const z = zoneAt(ev.clientX, ev.clientY);
      if (z !== hover) {
        hover?.classList.remove('drop-hover');
        z?.classList.add('drop-hover');
        hover = z;
      }
    };

    const up = (ev: PointerEvent) => {
      const dragged = !!ghost;
      cleanup.current();
      if (!dragged) return; // plain tap: let the click handler run
      // Swallow the click the browser fires right after a drag (if it fires at all).
      const swallow = (c: MouseEvent) => c.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      const z = zoneAt(ev.clientX, ev.clientY);
      if (z?.dataset.drop) onDropRef.current(item, z.dataset.drop);
    };

    cleanup.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      ghost?.remove();
      ghost = null;
      hover?.classList.remove('drop-hover');
      source.classList.remove('dragging');
    };
    const cancel = () => cleanup.current();

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
}

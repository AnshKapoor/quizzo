import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Tallest window seen at the current width = the screen without the on-screen keyboard.
let seen = { width: 0, height: 0 };
function fullHeight(): number {
  if (window.innerWidth !== seen.width || window.innerHeight > seen.height)
    seen = { width: window.innerWidth, height: window.innerHeight };
  return seen.height;
}

/**
 * Holds the question while studying. With the "Centred" placement it puts the question in the
 * middle of the screen, but decides the position once per question (`resetKey`): a keyboard
 * opening or feedback appearing must not make the question jump while it is being answered.
 */
export function Stage({ resetKey, children }: { resetKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      el.style.paddingTop = '0px';
      if (document.documentElement.dataset.layout !== 'center') return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottomGap = 48; // room for the screen's bottom padding
      const free = fullHeight() - top - el.offsetHeight - bottomGap;
      el.style.paddingTop = `${Math.max(0, Math.round(free * 0.45))}px`;
    };
    place();
    // Re-place on rotation / window width changes, not when the keyboard changes the height.
    let width = window.innerWidth;
    const onResize = () => {
      fullHeight();
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        place();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resetKey]);

  return (
    <div ref={ref} className="stage">
      {children}
    </div>
  );
}

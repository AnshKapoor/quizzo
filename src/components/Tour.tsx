import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
  /** `data-tour` name of the element to highlight. The first visible match is used. */
  target: string;
  title: string;
  text: string;
}

/** The first-run tours, one per screen. Steps whose element isn't on screen are skipped. */
export const TOURS = {
  home: [
    { target: 'deck', title: 'Your decks', text: 'A deck is a set of cards. Tap its name to open it and see or change the cards.' },
    { target: 'study', title: 'Study', text: 'Goes through the cards that are due today, without a clock. Cards you miss come back.' },
    { target: 'quiz', title: 'Quiz', text: 'The same cards against the clock. Faster right answers get a better mark.' },
    { target: 'new-deck', title: 'Make your own', text: 'Start an empty deck here, then add your own cards to it.' },
    { target: 'custom', title: 'Mix decks', text: 'A custom quiz picks questions from any of your decks and tests them together.' },
    { target: 'tools', title: 'Everything else', text: 'Import a deck file, back up to a Google Sheet, change the look, or open the help.' },
  ],
  deck: [
    { target: 'deck-run', title: 'Practise this deck', text: 'Study reviews what is due. Quiz puts every question on a timer.' },
    { target: 'add-card', title: 'Add a card', text: 'Tap here and pick a question type. Each type says what it is good for.' },
    { target: 'timed', title: 'Timed quizzes', text: 'Save a test for this deck, for example 10 questions in 5 minutes.' },
    { target: 'deck-menu', title: 'Deck options', text: 'Export, reset progress, delete and help are in this menu. Tap the title to rename the deck.' },
  ],
  editor: [
    { target: 'editor-help', title: 'Not sure what to type?', text: 'Open this for the steps for this card type, and a button that fills in an example.' },
    { target: 'preview', title: 'Try the card', text: 'The preview shows the card as learners see it. You can answer it there.' },
    { target: 'more-options', title: 'Extras', text: 'Pictures, a hint, an explanation, tags and the quiz time are tucked away here.' },
  ],
} satisfies Record<string, TourStep[]>;

export type TourId = keyof typeof TOURS;

const SEEN_KEY = 'quizzo.tours';

function seenTours(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function markSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seenTours(), id])]));
  } catch {
    /* storage unavailable: the tour shows again next time */
  }
}

/** Makes every tour show again (Help → Show the tour). */
export function resetTours(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    /* nothing to reset */
  }
}

function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const TIP_GAP = 12;

/**
 * Walks a first-time user through one screen: dims everything, cuts a hole around one element
 * at a time and explains it. The rest of the screen can't be clicked until the tour ends.
 * Shown once per screen (remembered on the device).
 */
export function Tour({ id }: { id: TourId }) {
  const steps: TourStep[] = TOURS[id];
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [tipHeight, setTipHeight] = useState(0);

  const finish = useCallback(() => {
    markSeen(id);
    setIndex(null);
    setBox(null);
  }, [id]);

  /** Moves to the first step at or after `from` whose element is on screen; ends the tour if none. */
  const show = useCallback(
    (from: number) => {
      for (let i = from; i < steps.length; i++) {
        const el = findTarget(steps[i].target);
        if (!el) continue;
        el.scrollIntoView({ block: 'center' });
        setIndex(i);
        return;
      }
      finish();
    },
    [steps, finish],
  );

  // Start once the screen has settled (its entrance animation moves things a little).
  useEffect(() => {
    if (seenTours().includes(id)) return;
    const t = setTimeout(() => show(0), 450);
    return () => clearTimeout(t);
  }, [id, show]);

  // Keep the hole on the element while the page scrolls, resizes or re-lays out.
  useLayoutEffect(() => {
    if (index === null) return;
    const measure = () => {
      const el = findTarget(steps[index].target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox((b) =>
        b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height
          ? b
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    };
    measure();
    const timer = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [index, steps]);

  useLayoutEffect(() => {
    if (tip.current) setTipHeight(tip.current.offsetHeight);
  }, [index, box]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, finish]);

  if (index === null || !box) return null;
  const step = steps[index];
  const last = !steps.slice(index + 1).some((s) => findTarget(s.target));
  const next = () => show(index + 1);

  // The explanation goes under the element when there is room, otherwise above it.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipWidth = Math.min(340, vw - 24);
  const below = box.top + box.height + PAD + TIP_GAP;
  const above = box.top - PAD - TIP_GAP - tipHeight;
  const tipTop = below + tipHeight <= vh - 12 || above < 12 ? Math.min(below, Math.max(12, vh - tipHeight - 12)) : above;
  const tipLeft = Math.min(Math.max(12, box.left + box.width / 2 - tipWidth / 2), vw - tipWidth - 12);

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <button
        type="button"
        className="tour-hole"
        aria-label="Next"
        style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
        onClick={next}
      />
      <div ref={tip} className="tour-tip" style={{ top: tipTop, left: tipLeft, width: tipWidth }}>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="row">
          <span className="sub">
            {index + 1} / {steps.length}
          </span>
          <span className="spacer" />
          {!last && (
            <button type="button" className="ghost" onClick={finish}>
              Skip
            </button>
          )}
          <button key={index} type="button" className="primary" autoFocus onClick={next}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect } from 'react';
import type { Grade } from '../types';

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: 'Again', key: '1' },
  { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' },
  { grade: 'easy', label: 'Easy', key: '4' },
];

/** The mark a quiz question gets by default: Again when missed, Easy when right (flashcards keep the learner's own). */
export const defaultGrade = (correct: boolean): Grade => (correct ? 'easy' : 'again');

/**
 * Shown after a quiz question is answered or runs out of time: one mark is already chosen,
 * and the learner can change it (click, or keys 1-4) before moving on.
 */
export function GradePicker({ value, onChange }: { value: Grade; onChange: (g: Grade) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName)) return;
      const g = GRADES.find((x) => x.key === e.key);
      if (g) onChange(g.grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="grades grade-picker" role="radiogroup" aria-label="How well did you know it?">
      {GRADES.map((g) => (
        <button
          key={g.grade}
          type="button"
          role="radio"
          aria-checked={value === g.grade}
          className={`grade grade-${g.grade} ${value === g.grade ? 'chosen' : ''}`}
          onClick={() => onChange(g.grade)}
        >
          {g.label}
          <kbd>{g.key}</kbd>
        </button>
      ))}
    </div>
  );
}

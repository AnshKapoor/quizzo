import { useEffect, useState } from 'react';
import type { FlashcardCard, Grade } from '../../types';
import { Explanation, SpeakButton } from '../common';
import type { CardViewProps } from './CardView';
import { useImageSrc } from '../ImageContext';

const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: 'Again', key: '1' },
  { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' },
  { grade: 'easy', label: 'Easy', key: '4' },
];

export function FlashcardView({ card, lang, onAnswer }: CardViewProps<FlashcardCard>) {
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<Grade | null>(null);
  const hintImage = useImageSrc(card.hintImage);

  const grade = (g: Grade) => {
    if (graded) return;
    setGraded(g);
    onAnswer({ correct: g !== 'again', grade: g });
  };

  // Keyboard: space reveals, 1-4 grade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && !graded) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) grade(g.grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="card-body">
      <div
        role="button"
        tabIndex={0}
        className={`flip ${revealed ? 'revealed' : ''}`}
        onClick={() => setRevealed(true)}
      >
        <div className="flip-front">
          <span className="big">{card.front}</span>
          <SpeakButton text={card.front} lang={lang} />
        </div>
        {!revealed && card.hint && <div className="hint">Hint: {card.hint}</div>}
        {!revealed && hintImage && <img className="card-image hint-image" src={hintImage} alt="Hint" />}
        {revealed ? (
          <div className="flip-back">
            <div className="answer">{card.back}</div>
            {card.example && (
              <div className="example">
                „{card.example}“ <SpeakButton text={card.example} lang={lang} />
              </div>
            )}
          </div>
        ) : (
          <div className="tap-hint">Tap or press Space to reveal</div>
        )}
      </div>
      {revealed && <Explanation text={card.explanation} />}
      {revealed && (
        <div className="grades">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              className={`grade grade-${g.grade} ${graded === g.grade ? 'chosen' : ''}`}
              disabled={!!graded}
              onClick={() => grade(g.grade)}
            >
              {g.label}
              <kbd>{g.key}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

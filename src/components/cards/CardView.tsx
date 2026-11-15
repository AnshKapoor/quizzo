import { useState } from 'react';
import type { AnswerResult, StudyCard } from '../../types';
import { CARD_TYPE_LABELS } from '../../lib/cardForm';
import { CategorizeView } from './CategorizeView';
import { ClozeBankView } from './ClozeBankView';
import { ClozeView } from './ClozeView';
import { DictationView } from './DictationView';
import { FlashcardView } from './FlashcardView';
import { MatchView } from './MatchView';
import { McqView } from './McqView';
import { OrderView } from './OrderView';
import { SequenceView } from './SequenceView';
import { SpotView } from './SpotView';
import { TableView } from './TableView';
import { useImageSrc } from '../ImageContext';

export interface CardViewProps<C extends StudyCard = StudyCard> {
  card: C;
  /** Target language code, e.g. 'de'. */
  lang: string;
  onAnswer: (r: AnswerResult) => void;
  /** Play audio straight away (dictation). Off in the editor preview. */
  autoPlay?: boolean;
  /** Small label above the card, e.g. which question a vocabulary entry produced. */
  label?: string;
}

/** Renders any card type. Give it a `key` per card so its internal state resets. */
export function CardView(props: CardViewProps) {
  const { card } = props;
  const image = useImageSrc(card.image);
  const hintImage = useImageSrc(card.hintImage);
  // Flashcards show their hint on the front themselves.
  const hasHint = card.type !== 'flashcard' && !!(card.hint || hintImage);
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <div className={`card card-${card.type}`}>
      <div className="card-head">
        <span className="card-type">{props.label ?? CARD_TYPE_LABELS[card.type]}</span>
        {/* In the header from the start: a hint is only useful before answering. */}
        {hasHint && (
          <button
            type="button"
            className={`chip hint-btn ${hintOpen ? 'active' : ''}`}
            aria-expanded={hintOpen}
            onClick={() => setHintOpen((o) => !o)}
          >
            💡 Hint
          </button>
        )}
      </div>
      {hasHint && hintOpen && (
        <div className="hint hint-open">
          {card.hint && <span>{card.hint}</span>}
          {hintImage && <img className="card-image hint-image" src={hintImage} alt="Hint" />}
        </div>
      )}
      {image && <img className="card-image" src={image} alt="" />}
      {card.type === 'flashcard' && <FlashcardView {...props} card={card} />}
      {card.type === 'mcq' && <McqView {...props} card={card} />}
      {card.type === 'match' && <MatchView {...props} card={card} />}
      {card.type === 'cloze' && (card.wordBank ? <ClozeBankView {...props} card={card} /> : <ClozeView {...props} card={card} />)}
      {card.type === 'order' && <OrderView {...props} card={card} />}
      {card.type === 'categorize' && <CategorizeView {...props} card={card} />}
      {card.type === 'spot' && <SpotView {...props} card={card} />}
      {card.type === 'dictation' && <DictationView {...props} card={card} />}
      {card.type === 'sequence' && <SequenceView {...props} card={card} />}
      {card.type === 'table' && <TableView {...props} card={card} />}
    </div>
  );
}

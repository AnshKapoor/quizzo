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

/** Hint text and / or picture behind a button, so looking at it is the learner's choice. */
function HintToggle({ text, image: ref }: { text?: string; image?: string }) {
  const [open, setOpen] = useState(false);
  const image = useImageSrc(ref);
  if (!text && !image) return null;
  return open ? (
    <div className="hint hint-open">
      {text && <span>💡 {text}</span>}
      {image && <img className="card-image hint-image" src={image} alt="Hint" />}
    </div>
  ) : (
    <button type="button" className="ghost hint-btn" onClick={() => setOpen(true)}>
      💡 Show hint
    </button>
  );
}

/** Renders any card type. Give it a `key` per card so its internal state resets. */
export function CardView(props: CardViewProps) {
  const { card } = props;
  const image = useImageSrc(card.image);
  return (
    <div className={`card card-${card.type}`}>
      <div className="card-type">{props.label ?? CARD_TYPE_LABELS[card.type]}</div>
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
      {/* Flashcards show their hint on the front themselves. */}
      {card.type !== 'flashcard' && <HintToggle text={card.hint} image={card.hintImage} />}
    </div>
  );
}

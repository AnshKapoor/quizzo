import { useState } from 'react';
import type { Appearance as AppearanceSettings } from '../types';
import { CARD_STYLES, DEFAULT_APPEARANCE, FONTS, LAYOUTS, SIZES, THEMES } from '../lib/appearance';
import { CARD_HELP } from '../lib/help';
import { expandCard } from '../lib/vocab';
import { CardView } from '../components/cards/CardView';

interface Props {
  value: AppearanceSettings;
  /** Only the changed settings; merged into the saved ones. */
  onChange: (change: Partial<AppearanceSettings>) => void;
  /** Default seconds per question in quizzes timed per card. */
  questionTime: number;
  onQuestionTime: (seconds: number) => void;
  onBack: () => void;
}

function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            className={`chip ${value === o.id ? 'active' : ''}`}
            onClick={() => onPick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Default time for quiz questions; kept as typed so the field can be emptied while editing. */
function QuestionTime({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  const [text, setText] = useState(String(value));
  const commit = (s: string) => {
    const n = Math.round(Number(s.replace(',', '.')));
    if (n > 0 && n <= 3600) onChange(n);
  };
  return (
    <label className="field">
      <span>Default time per question (seconds)</span>
      <input
        type="number"
        min={1}
        max={3600}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(String(value))}
      />
      <small>
        Used in the deck Quiz and in timed quizzes set to each card's own time, for cards that don't set their own time. Study (review) has no clock.
      </small>
    </label>
  );
}

/** Quiz timing, plus theme, font, text size, card style and where questions sit. Changes apply immediately. */
export function Appearance({ value, onChange, questionTime, onQuestionTime, onBack }: Props) {
  const set = <K extends keyof AppearanceSettings>(k: K, v: AppearanceSettings[K]) => onChange({ [k]: v } as Partial<AppearanceSettings>);
  const [round, setRound] = useState(0);
  const layout = LAYOUTS.find((l) => l.id === value.layout)!;

  return (
    <div className="screen appearance">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>
          ← Back
        </button>
        <strong>Settings</strong>
        <button
          type="button"
          className="ghost"
          title="Reset the appearance settings"
          disabled={JSON.stringify(value) === JSON.stringify(DEFAULT_APPEARANCE)}
          onClick={() => onChange(DEFAULT_APPEARANCE)}
        >
          Reset look
        </button>
      </header>

      <div className="appearance-grid">
        <div className="appearance-options">
          <h3 className="settings-heading">Quizzes</h3>
          <QuestionTime value={questionTime} onChange={onQuestionTime} />
          <h3 className="settings-heading">Appearance</h3>
          <div className="field">
            <span>Theme</span>
            <div className="theme-grid" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={value.theme === t.id}
                  className={`theme-swatch ${value.theme === t.id ? 'active' : ''}`}
                  onClick={() => set('theme', t.id)}
                >
                  <span className="swatch" style={{ background: t.swatch[0] }}>
                    <span style={{ background: t.swatch[1] }} />
                    <span style={{ background: t.swatch[2] }} />
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Choice label="Question placement" options={LAYOUTS} value={value.layout} onPick={(v) => set('layout', v)} />
          <small className="sub layout-note">{layout.text} Used when studying and in quizzes.</small>
          <Choice label="Card style" options={CARD_STYLES} value={value.cards} onPick={(v) => set('cards', v)} />
          <Choice label="Font" options={FONTS} value={value.font} onPick={(v) => set('font', v)} />
          <Choice label="Text size" options={SIZES} value={value.size} onPick={(v) => set('size', v)} />
        </div>

        <aside className="appearance-preview-wrap">
          <div className="row">
            <span className="sub">Preview — try it</span>
            <span className="spacer" />
            <button type="button" className="ghost" onClick={() => setRound((r) => r + 1)}>
              ↺ Reset look
            </button>
          </div>
          <div className="layout-preview">
            <div className="layout-preview-bar">
              <span className="mode-pill">⏱ Preview</span>
              <span className="clock">4:32</span>
            </div>
            <div className="stage">
              <CardView key={round} card={expandCard(CARD_HELP.mcq.example)[0].card} lang="de" onAnswer={() => {}} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

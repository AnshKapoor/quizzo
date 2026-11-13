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

/** Theme, font, text size, card style and where questions sit. Changes apply immediately. */
export function Appearance({ value, onChange, onBack }: Props) {
  const set = <K extends keyof AppearanceSettings>(k: K, v: AppearanceSettings[K]) => onChange({ [k]: v } as Partial<AppearanceSettings>);
  const [round, setRound] = useState(0);
  const layout = LAYOUTS.find((l) => l.id === value.layout)!;

  return (
    <div className="screen appearance">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>
          ← Back
        </button>
        <strong>Appearance</strong>
        <button
          type="button"
          className="ghost"
          disabled={JSON.stringify(value) === JSON.stringify(DEFAULT_APPEARANCE)}
          onClick={() => onChange(DEFAULT_APPEARANCE)}
        >
          Reset
        </button>
      </header>

      <div className="appearance-grid">
        <div className="appearance-options">
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
              ↺ Reset
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

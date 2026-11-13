// Themes, fonts, text size and question layout. Applied as data-* attributes on <html>;
// styles.css does the rest.
import type { Appearance, ThemeId } from '../types';

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'auto',
  font: 'sans',
  size: 'm',
  layout: 'center',
  cards: 'raised',
};

/** Swatch colours: background, card, accent (for the theme picker). */
export const THEMES: { id: ThemeId; label: string; swatch: [string, string, string] }[] = [
  { id: 'auto', label: 'Match device', swatch: ['#f6f5f1', '#1e1e22', '#2f5fd0'] },
  { id: 'light', label: 'Light', swatch: ['#f6f5f1', '#ffffff', '#2f5fd0'] },
  { id: 'dark', label: 'Dark', swatch: ['#141416', '#1e1e22', '#6b93ff'] },
  { id: 'sepia', label: 'Sepia', swatch: ['#f3ead8', '#fbf6ea', '#9a5b13'] },
  { id: 'ocean', label: 'Ocean', swatch: ['#e8f1f8', '#ffffff', '#0b7a8f'] },
  { id: 'forest', label: 'Forest', swatch: ['#eaf1e6', '#fafcf8', '#2f7d3b'] },
  { id: 'midnight', label: 'Midnight', swatch: ['#0f1226', '#191d38', '#b48cff'] },
  { id: 'contrast', label: 'High contrast', swatch: ['#000000', '#000000', '#ffd400'] },
];

export const FONTS: { id: Appearance['font']; label: string }[] = [
  { id: 'sans', label: 'Standard' },
  { id: 'serif', label: 'Serif' },
  { id: 'wide', label: 'Wide' },
  { id: 'mono', label: 'Typewriter' },
];

export const SIZES: { id: Appearance['size']; label: string }[] = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Normal' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

export const LAYOUTS: { id: Appearance['layout']; label: string; text: string }[] = [
  { id: 'center', label: 'Centred', text: 'Question in the middle of the screen, text centred.' },
  { id: 'top-center', label: 'Top, centred', text: 'Question at the top, text centred.' },
  { id: 'left', label: 'Top, left', text: 'Question at the top, text aligned left.' },
];

export const CARD_STYLES: { id: Appearance['cards']; label: string }[] = [
  { id: 'raised', label: 'Raised' },
  { id: 'flat', label: 'Flat' },
  { id: 'outlined', label: 'Outlined' },
];

const pick = <T extends string>(value: unknown, allowed: { id: T }[], fallback: T): T =>
  allowed.some((a) => a.id === value) ? (value as T) : fallback;

/** Fills in missing or unknown values (older libraries, hand-edited backups). */
export function normalizeAppearance(a: unknown): Appearance {
  const x = (a ?? {}) as Partial<Appearance>;
  const d = DEFAULT_APPEARANCE;
  return {
    theme: pick(x.theme, THEMES, d.theme),
    font: pick(x.font, FONTS, d.font),
    size: pick(x.size, SIZES, d.size),
    layout: pick(x.layout, LAYOUTS, d.layout),
    cards: pick(x.cards, CARD_STYLES, d.cards),
  };
}

const CACHE_KEY = 'quizzo.appearance';

export function applyAppearance(a: Appearance): void {
  const el = document.documentElement;
  el.dataset.theme = a.theme;
  el.dataset.font = a.font;
  el.dataset.size = a.size;
  el.dataset.layout = a.layout;
  el.dataset.cards = a.cards;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable: the library still keeps the setting */
  }
}

/** Applies the last used appearance before the library has loaded, so the theme doesn't flash. */
export function applyCachedAppearance(): void {
  let cached: unknown;
  try {
    cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
  } catch {
    cached = null;
  }
  applyAppearance(normalizeAppearance(cached));
}

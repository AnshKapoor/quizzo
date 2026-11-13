import type { Deck, DeckFile, Library } from '../types';
import starter from '../data/german-a1-starter.quizzo.json';
import practice from '../data/german-a1-practice.quizzo.json';
import { validateDeck } from './validate';

// Desktop (Electron) exposes a JSON file on disk through the preload script.
// Browser / Android fall back to localStorage for now.
declare global {
  interface Window {
    quizzoNative?: {
      readLibrary(): Promise<string | null>;
      writeLibrary(json: string): Promise<void>;
      libraryPath(): Promise<string>;
    };
  }
}

const KEY = 'quizzo.library.v1';

export function emptyLibrary(): Library {
  return { format: 'quizzo-library', version: 1, decks: [], progress: {} };
}

/** Decks shipped with the app. New ones reach existing installs once (see addBuiltinDecks). */
const BUILTIN_FILES = [starter, practice] as unknown as DeckFile[];
export const BUILTIN_IDS = BUILTIN_FILES.map((f) => f.deck.id);

/** Adds built-in decks this library has never received. Decks the user deleted stay deleted. */
export function addBuiltinDecks(lib: Library): Library {
  // Libraries from before `seeded` existed: count the built-ins they already have as received.
  const seeded = lib.seeded ?? lib.decks.map((d) => d.id).filter((id) => BUILTIN_IDS.includes(id));
  const decks = lib.decks.slice();
  for (const file of BUILTIN_FILES) {
    if (seeded.includes(file.deck.id) || decks.some((d) => d.id === file.deck.id)) continue;
    const { deck } = validateDeck(file.deck);
    if (deck) decks.push(deck);
  }
  return { ...lib, decks, seeded: Array.from(new Set([...seeded, ...BUILTIN_IDS])) };
}

export function starterLibrary(): Library {
  return addBuiltinDecks({ ...emptyLibrary(), seeded: [] });
}

export async function loadLibrary(): Promise<Library> {
  try {
    const raw = window.quizzoNative ? await window.quizzoNative.readLibrary() : localStorage.getItem(KEY);
    if (raw) {
      const lib = JSON.parse(raw) as Library;
      if (lib?.format === 'quizzo-library' && Array.isArray(lib.decks)) {
        const customQuizzes = Array.isArray(lib.customQuizzes)
          ? lib.customQuizzes.filter((q) => q && typeof q.id === 'string' && Array.isArray(q.picks))
          : undefined;
        return addBuiltinDecks({ ...lib, progress: lib.progress ?? {}, customQuizzes });
      }
    }
  } catch (e) {
    console.error('Could not load library, starting fresh', e);
  }
  return starterLibrary();
}

export async function saveLibrary(lib: Library): Promise<void> {
  const raw = JSON.stringify(lib, null, 2);
  if (window.quizzoNative) await window.quizzoNative.writeLibrary(raw);
  else localStorage.setItem(KEY, raw);
}

// ---- export ----

export function deckToFile(deck: Deck): DeckFile {
  return { format: 'quizzo-deck', version: 1, deck };
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

/** Browser + Electron download. TODO(android): use @capacitor/filesystem + @capacitor/share. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

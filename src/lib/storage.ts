import type { Deck, DeckFile, Library } from '../types';
import starter from '../data/german-a1-starter.quizzo.json';
import practice from '../data/german-a1-practice.quizzo.json';
import { validateDeck } from './validate';
import { normalizeImages } from './image';

// Desktop (Electron) exposes a JSON file on disk through the preload script.
// Browser / Android keep it in IndexedDB (older versions used localStorage; it is moved over on first save).
declare global {
  interface Window {
    quizzoNative?: {
      readLibrary(): Promise<string | null>;
      writeLibrary(json: string): Promise<void>;
      libraryPath(): Promise<string>;
      /** HTTP from the main process (desktop), so requests aren't subject to the page's CORS rules. */
      http?(url: string, init: { method: 'GET' | 'POST'; body?: string }): Promise<{ status: number; text: string }>;
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

/** Fills in missing parts of a stored or restored library and drops malformed custom quizzes. */
export function normalizeLibrary(lib: Library): Library {
  const customQuizzes = Array.isArray(lib.customQuizzes)
    ? lib.customQuizzes.filter((q) => q && typeof q.id === 'string' && Array.isArray(q.picks))
    : undefined;
  const progress = lib.progress && typeof lib.progress === 'object' ? lib.progress : {};
  const attempts = Array.isArray(lib.attempts) ? lib.attempts : undefined;
  const images = lib.images && typeof lib.images === 'object' ? lib.images : undefined;
  return normalizeImages({ ...lib, format: 'quizzo-library', version: 1, progress, attempts, customQuizzes, images });
}

// ---- browser / Android storage: IndexedDB (hundreds of MB) instead of localStorage (about 5 MB) ----

const DB_NAME = 'quizzo';
const DB_STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(DB_STORE, mode);
    const req = run(tx.objectStore(DB_STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
  });
}

/** The saved library text: IndexedDB first, then (older versions) localStorage. */
async function readBrowser(): Promise<string | null> {
  try {
    const raw = await idb<string | undefined>('readonly', (s) => s.get(KEY));
    if (raw) return raw;
  } catch (e) {
    console.warn('IndexedDB unavailable, using localStorage', e);
  }
  return localStorage.getItem(KEY);
}

async function writeBrowser(raw: string): Promise<void> {
  try {
    await idb('readwrite', (s) => s.put(raw, KEY));
  } catch (e) {
    console.warn('IndexedDB write failed, using localStorage', e);
    localStorage.setItem(KEY, raw);
    return;
  }
  // Moved over: free the old, small localStorage copy (it would go stale anyway).
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Asks the browser not to clear Quizzo's storage when the device runs low on space. */
function askPersistent() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function loadLibrary(): Promise<Library> {
  try {
    const raw = window.quizzoNative ? await window.quizzoNative.readLibrary() : await readBrowser();
    if (!window.quizzoNative) askPersistent();
    if (raw) {
      const lib = JSON.parse(raw) as Library;
      if (lib?.format === 'quizzo-library' && Array.isArray(lib.decks)) return addBuiltinDecks(normalizeLibrary(lib));
    }
  } catch (e) {
    console.error('Could not load library, starting fresh', e);
  }
  return starterLibrary();
}

export async function saveLibrary(lib: Library): Promise<void> {
  if (window.quizzoNative) await window.quizzoNative.writeLibrary(JSON.stringify(lib, null, 2));
  else await writeBrowser(JSON.stringify(lib));
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

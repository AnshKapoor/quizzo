// Pictures on cards (question image, hint image).
//
// In the library each picture is stored once in `Library.images`, named by a fingerprint of its content;
// cards hold a short `img:<id>` reference. The same picture always gets the same name, so it is stored and
// uploaded once however many cards and backups use it, and a reference can't point at the wrong picture.
// Deck files (export / import) carry the pictures inline as data URLs so a single file is complete.
import type { Card, Deck, Library } from '../types';
import { fingerprint } from './util';

export const IMAGE_REF = 'img:';
const FIELDS = ['image', 'hintImage'] as const;

/** Longest side of a stored picture, in pixels. Plenty for a card, small enough for phone storage. */
export const MAX_IMAGE_SIDE = 800;
const QUALITY = 0.8;

/** Pictures on cards: a data URL, an https link, or (inside the library) an `img:<id>` reference. */
export function isImageSource(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$|https:\/\/\S+$|img:[0-9a-z-]+$)/.test(v)
  );
}

/** Rough size of a stored picture in KB (base64 is 4/3 of the bytes). */
export const imageKb = (src: string) => Math.round((src.length * 3) / 4 / 1024);

/** The first picture in a paste or drop, if any. */
export function imageFromTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  return Array.from(data.files ?? []).find((f) => f.type.startsWith('image/')) ?? null;
}

/** Shrinks a picture to at most MAX_IMAGE_SIDE and returns it as a compact data URL (WebP, else JPEG/PNG). */
export async function imageToDataUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This file is not a picture the app can read.'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', QUALITY);
    if (webp.startsWith('data:image/webp')) return webp;
    // Browsers without WebP export: PNG keeps transparency (screenshots), JPEG is smaller for photos.
    const png = canvas.toDataURL('image/png');
    const jpeg = canvas.toDataURL('image/jpeg', QUALITY);
    return jpeg.length < png.length * 0.7 ? jpeg : png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The picture a card field points at, ready for <img src>. */
export function resolveImage(src: string | undefined, images: Record<string, string> | undefined): string | undefined {
  if (!src) return undefined;
  return src.startsWith(IMAGE_REF) ? images?.[src.slice(IMAGE_REF.length)] : src;
}

/**
 * Puts pasted / imported pictures (data URLs) into the store and refers to them from the cards, and drops
 * stored pictures no card uses any more. Returns the same object when nothing changed.
 */
export function normalizeImages(lib: Library): Library {
  const store = { ...(lib.images ?? {}) };
  let changed = false;
  const decks = lib.decks.map((deck) => {
    let deckChanged = false;
    const cards = deck.cards.map((card) => {
      let next: Card = card;
      for (const f of FIELDS) {
        const v = card[f];
        if (!v?.startsWith('data:')) continue;
        let id = fingerprint(v);
        // Same name for different content is practically impossible; never overwrite a picture anyway.
        for (let n = 2; store[id] !== undefined && store[id] !== v; n++) id = `${fingerprint(v)}-${n}`;
        store[id] = v;
        next = { ...next, [f]: IMAGE_REF + id };
      }
      if (next !== card) deckChanged = true;
      return next;
    });
    if (!deckChanged) return deck;
    changed = true;
    return { ...deck, cards };
  });
  const used = referencedImages({ ...lib, decks });
  for (const id of Object.keys(store)) if (!used.has(id)) delete store[id];
  const before = Object.keys(lib.images ?? {});
  if (!changed && before.length === Object.keys(store).length) return lib;
  return { ...lib, decks, images: Object.keys(store).length ? store : undefined };
}

/** Ids of the stored pictures the library's cards use. */
export function referencedImages(lib: Library): Set<string> {
  const ids = new Set<string>();
  for (const d of lib.decks)
    for (const c of d.cards) for (const f of FIELDS) if (c[f]?.startsWith(IMAGE_REF)) ids.add(c[f]!.slice(IMAGE_REF.length));
  return ids;
}

/** A deck with its pictures inline again, for a self-contained deck file. Missing pictures are left out. */
export function inlineDeckImages(deck: Deck, images: Record<string, string> | undefined): Deck {
  return {
    ...deck,
    cards: deck.cards.map((card) => {
      let next: Card = card;
      for (const f of FIELDS) {
        const v = card[f];
        if (!v?.startsWith(IMAGE_REF)) continue;
        const { [f]: _drop, ...rest } = next;
        const src = resolveImage(v, images);
        next = (src ? { ...rest, [f]: src } : rest) as Card;
      }
      return next;
    }),
  };
}

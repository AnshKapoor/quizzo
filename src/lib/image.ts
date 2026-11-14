// Pictures on cards (question image, hint image). They are stored inside the card as small data URLs,
// so they travel with exported decks and backups and work offline.

/** Longest side of a stored picture, in pixels. Plenty for a card, small enough for phone storage. */
export const MAX_IMAGE_SIDE = 800;
const QUALITY = 0.8;

/** Pictures in deck files: a data URL from the editor, or an https link. */
export function isImageSource(v: unknown): v is string {
  return typeof v === 'string' && /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$|https:\/\/\S+$)/.test(v);
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

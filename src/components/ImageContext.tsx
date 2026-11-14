import { createContext, useContext } from 'react';
import { resolveImage } from '../lib/image';

/** The library's stored pictures, so any card can show its `img:<id>` pictures. */
export const ImagesContext = createContext<Record<string, string> | undefined>(undefined);

/** The <img src> for a card picture field (a stored reference, a data URL or a link). */
export function useImageSrc(src: string | undefined): string | undefined {
  return resolveImage(src, useContext(ImagesContext));
}

export type ClozeSegment =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; index: number; answers: string[]; hint?: string };

const BLANK = /\{\{(.+?)\}\}/g;

export function parseCloze(text: string): ClozeSegment[] {
  const out: ClozeSegment[] = [];
  let last = 0;
  let index = 0;
  for (const m of text.matchAll(BLANK)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    const [answersPart, hint] = m[1].split('::');
    const answers = answersPart.split('|').map((s) => s.trim()).filter(Boolean);
    out.push({ kind: 'blank', index: index++, answers, hint: hint?.trim() || undefined });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** The sentence with every blank filled with its first answer (for display and text-to-speech). */
export function clozeSolution(text: string): string {
  return parseCloze(text)
    .map((s) => (s.kind === 'text' ? s.text : (s.answers[0] ?? '')))
    .join('');
}

export function blankCount(text: string): number {
  return parseCloze(text).filter((s) => s.kind === 'blank').length;
}

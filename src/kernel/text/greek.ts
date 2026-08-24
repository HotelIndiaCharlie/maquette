/**
 * Greeking — SPEC.md §4.10. Deterministic pseudo-Latin: the same n always
 * yields the same words, so greeked layouts do not shimmer between renders.
 *
 * Vocabulary is the printer's own (reference/maquette.html): it reads as type,
 * not as language, which is the whole point of greeking.
 */
const WORDS = (
  'dolor ipsum meridian caslon galley recto verso folio bastard quire signature ' +
  'widow orphan kern pica em en slug leading chase furniture quoin brayer platen ' +
  'frisket tympan deckle vellum colophon incunable majuscule minuscule swash ligature'
).split(' ');

export function greek(nWords: number): string {
  const n = Math.max(0, Math.floor(nWords));
  if (n === 0) return '';
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) out.push(WORDS[(i * 7 + 3) % WORDS.length]!);
  return `${out.join(' ')}.`;
}

export const GREEK_VOCABULARY: ReadonlyArray<string> = WORDS;

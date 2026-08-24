import { greek } from './greek';
import { measure, wordsToFill } from './measure';
import { FidelityBadge } from './FidelityBadge';

export { greek, GREEK_VOCABULARY } from './greek';
export { measure, wordsToFill, AVG_CHAR_WIDTH_RATIO } from './measure';
export type { MeasureAttrs, Measurement } from './measure';
export { FidelityBadge } from './FidelityBadge';
export type { Fidelity, FidelityBadgeProps } from './FidelityBadge';

/** The text seam as handed to plugins (SPEC.md §4.5). */
export interface TextApi {
  greek: typeof greek;
  measure: typeof measure;
  wordsToFill: typeof wordsToFill;
  FidelityBadge: typeof FidelityBadge;
}

export const textApi: TextApi = { greek, measure, wordsToFill, FidelityBadge };

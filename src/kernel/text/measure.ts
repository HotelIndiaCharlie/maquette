/**
 * Text measurement seam — SPEC.md §4.10.
 *
 * v1 is a STATED APPROXIMATION: average character width = 0.5 × sizePt,
 * expressed in mm. It is not kerned, not hyphenated, not font-aware. The seam
 * exists so a real engine can replace it without any plugin changing
 * (P2 `copyflow` is the consumer that will feel the difference).
 *
 * Fidelity honesty rule (§4.10): any surface showing measured text must render
 * `FidelityBadge`. Maquette never claims print truth.
 */
import type { TextAttrs } from '../model/types';
import { ptToMm } from '../geometry/units';

/** Average character width as a fraction of the point size. §4.10 fixes 0.5. */
export const AVG_CHAR_WIDTH_RATIO = 0.5;

export interface MeasureAttrs extends TextAttrs {
  /** Frame height, when known — required for `overflow` to mean anything. */
  heightMm?: number;
}

export interface Measurement {
  lines: number;
  overflow: boolean;
  /** Extra detail the badge and P2's fill % need; not part of the §4.10 pair. */
  charsPerLine: number;
  usedHeightMm: number;
  fill: number; // 0..1 when heightMm is known, else 0
}

export function measure(text: string, widthMm: number, attrs: MeasureAttrs): Measurement {
  const charWidthMm = ptToMm(attrs.sizePt) * AVG_CHAR_WIDTH_RATIO;
  const leadingMm = ptToMm(attrs.leadingPt);
  const charsPerLine = charWidthMm > 0 ? Math.max(1, Math.floor(widthMm / charWidthMm)) : 1;
  const lines = text.length === 0 ? 0 : Math.ceil(text.length / charsPerLine);
  // Rounded once, then reused: a surface reporting "25.4 mm used" and "25% full"
  // must not be quoting two different numbers.
  const usedHeightMm = Math.round(lines * leadingMm * 1000) / 1000;
  const heightMm = attrs.heightMm;
  return {
    lines,
    charsPerLine,
    usedHeightMm,
    overflow: heightMm !== undefined && usedHeightMm > heightMm + 1e-9,
    fill: heightMm !== undefined && heightMm > 0 ? usedHeightMm / heightMm : 0,
  };
}

/** How many greeked words fill a frame — what a MiniView/FullView asks for. */
export function wordsToFill(widthMm: number, heightMm: number, attrs: TextAttrs): number {
  const charWidthMm = ptToMm(attrs.sizePt) * AVG_CHAR_WIDTH_RATIO;
  const leadingMm = ptToMm(attrs.leadingPt);
  if (!(charWidthMm > 0) || !(leadingMm > 0)) return 0;
  const charsPerLine = Math.max(1, Math.floor(widthMm / charWidthMm));
  const lines = Math.max(1, Math.floor(heightMm / leadingMm));
  const AVG_WORD_CHARS = 6;
  return Math.max(1, Math.floor((charsPerLine * lines) / AVG_WORD_CHARS));
}

/**
 * Units — SPEC.md §4.6. Millimetres are the document's native unit; points are
 * type; pixels only ever exist at the edge, via a viewport scale.
 */

/** Millimetres per typographic point. SPEC.md §4.6 fixes this value. */
export const PT = 0.3528;

export function ptToMm(pt: number): number {
  return pt * PT;
}

export function mmToPt(mm: number): number {
  return mm / PT;
}

/** `scale` is px per mm (ViewportApi.scale()). */
export function mmToPx(mm: number, scale: number): number {
  return mm * scale;
}

export function pxToMm(px: number, scale: number): number {
  return px / scale;
}

/** Font size in px at a given viewport scale — the only correct way to set type. */
export function ptToPx(pt: number, scale: number): number {
  return pt * PT * scale;
}

export function roundTo(value: number, stepMm: number): number {
  return Math.round(value / stepMm) * stepMm;
}

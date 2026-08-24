/**
 * Guides and grids — SPEC.md §4.6. All pure, all in spread space (mm).
 *
 * Spread space: x runs 0 … 2 × page.wMm across both pages, y runs 0 … page.hMm.
 */
import type { PageSetup } from '../model/types';
import { ptToMm } from './units';

/** Coarse grid (flatplan drawing): pageW/6 × pageH/8. SPEC.md §4.6. */
export const COARSE_COLS = 6;
export const COARSE_ROWS = 8;

export interface CoarseCell {
  wMm: number;
  hMm: number;
}

export function coarseCell(page: PageSetup): CoarseCell {
  return { wMm: page.wMm / COARSE_COLS, hMm: page.hMm / COARSE_ROWS };
}

/** Left edge of each page's text area, in spread space. */
export function pageTextLefts(page: PageSetup): [number, number] {
  return [page.margins.outside, page.wMm + page.margins.inside];
}

/** Width of one page's text area. */
export function textWidthMm(page: PageSetup): number {
  return page.wMm - page.margins.inside - page.margins.outside;
}

export function columnWidthMm(page: PageSetup, cols: number): number {
  const n = Math.max(1, Math.round(cols));
  return (textWidthMm(page) - (n - 1) * page.columnGutterMm) / n;
}

/** Margin box (text area) of each page, in spread space. */
export function marginBoxes(page: PageSetup): Array<{ x: number; y: number; w: number; h: number }> {
  const h = page.hMm - page.margins.top - page.margins.bottom;
  return pageTextLefts(page).map((x) => ({ x, y: page.margins.top, w: textWidthMm(page), h }));
}

/**
 * Every vertical edge a frame can snap to: each column's left edge and the
 * gutter edge that precedes it, on both pages. Sorted, de-duplicated.
 */
export function columnEdges(page: PageSetup, cols: number): number[] {
  const n = Math.max(1, Math.round(cols));
  const cw = columnWidthMm(page, n);
  const pitch = cw + page.columnGutterMm;
  const edges: number[] = [];
  for (const left of pageTextLefts(page)) {
    for (let c = 0; c <= n; c += 1) {
      const e = left + c * pitch;
      edges.push(e);
      edges.push(e - page.columnGutterMm);
    }
  }
  return dedupeSorted(edges);
}

/**
 * Baselines: from the top margin down, one every `leadingPt`, stopping at the
 * bottom margin. SPEC.md §4.6 / §7 B4.
 */
export function baselines(page: PageSetup, leadingPt: number): number[] {
  const pitch = ptToMm(leadingPt);
  if (!(pitch > 0)) return [];
  const bottom = page.hMm - page.margins.bottom;
  const out: number[] = [];
  for (let y = page.margins.top; y <= bottom + 1e-9; y += pitch) {
    out.push(round3(y));
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function dedupeSorted(values: number[]): number[] {
  const sorted = [...values].map(round3).sort((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || Math.abs(v - sorted[i - 1]!) > 1e-6);
}

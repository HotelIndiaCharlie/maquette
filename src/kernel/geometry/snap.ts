/**
 * Snapping — SPEC.md §4.6, fixed points, no negotiable defaults:
 *
 *   coarse (flatplan): grid cell = pageW/6 × pageH/8
 *   fine x (spread)  : column / gutter edges within 3 mm
 *   fine y (spread)  : baselines (every body leading from the top margin) within 2 mm
 *   otherwise        : round to 1 mm
 *
 * `guideMm` on the result is the guide that was matched — B4 flashes it.
 */
import type { PageSetup, Rect } from '../model/types';
import { baselines, coarseCell, columnEdges } from './grid';
import { roundTo } from './units';

export const SNAP_X_TOLERANCE_MM = 3;
export const SNAP_Y_TOLERANCE_MM = 2;
export const FALLBACK_STEP_MM = 1;

export interface SnapContext {
  page: PageSetup;
  cols: number;
  /** Baseline pitch — the body leading in force on this spread. */
  leadingPt: number;
  /** Snap toggle (B5). When false, values are only rounded to 1 mm. */
  enabled?: boolean;
}

export interface SnapResult {
  value: number;
  snapped: boolean;
  /** The guide coordinate that was matched, when one was. */
  guideMm?: number;
}

function nearest(value: number, candidates: number[], toleranceMm: number): SnapResult {
  let best: number | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  if (best !== undefined && bestDist < toleranceMm) {
    return { value: best, snapped: true, guideMm: best };
  }
  return { value: roundTo(value, FALLBACK_STEP_MM), snapped: false };
}

export function snapXFine(x: number, ctx: SnapContext): SnapResult {
  if (ctx.enabled === false) return { value: roundTo(x, FALLBACK_STEP_MM), snapped: false };
  return nearest(x, columnEdges(ctx.page, ctx.cols), SNAP_X_TOLERANCE_MM);
}

export function snapYFine(y: number, ctx: SnapContext): SnapResult {
  if (ctx.enabled === false) return { value: roundTo(y, FALLBACK_STEP_MM), snapped: false };
  return nearest(y, baselines(ctx.page, ctx.leadingPt), SNAP_Y_TOLERANCE_MM);
}

export interface SnappedPoint {
  x: number;
  y: number;
  guides: { x?: number; y?: number };
}

export function snapPointFine(p: { x: number; y: number }, ctx: SnapContext): SnappedPoint {
  const sx = snapXFine(p.x, ctx);
  const sy = snapYFine(p.y, ctx);
  return {
    x: sx.value,
    y: sy.value,
    guides: {
      ...(sx.guideMm !== undefined ? { x: sx.guideMm } : {}),
      ...(sy.guideMm !== undefined ? { y: sy.guideMm } : {}),
    },
  };
}

/** Coarse snap for the flatplan: whole grid cells. */
export function snapPointCoarse(p: { x: number; y: number }, page: PageSetup): SnappedPoint {
  const cell = coarseCell(page);
  return {
    x: roundTo(p.x, cell.wMm),
    y: roundTo(p.y, cell.hMm),
    guides: {},
  };
}

/** Coarse-snapped rect from two drag corners, never smaller than one cell. */
export function snapRectCoarse(
  a: { x: number; y: number },
  b: { x: number; y: number },
  page: PageSetup,
): Rect {
  const cell = coarseCell(page);
  const p1 = snapPointCoarse(a, page);
  const p2 = snapPointCoarse(b, page);
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  return {
    x,
    y,
    w: Math.max(cell.wMm, Math.abs(p2.x - p1.x)),
    h: Math.max(cell.hMm, Math.abs(p2.y - p1.y)),
  };
}

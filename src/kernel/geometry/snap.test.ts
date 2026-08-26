/** Snap tables — SPEC.md §4.6 fixed points, §4.11. */
import { describe, expect, it } from 'vitest';
import { baselines, coarseCell, columnEdges, columnWidthMm, marginBoxes } from './grid';
import {
  FALLBACK_STEP_MM,
  SNAP_X_TOLERANCE_MM,
  SNAP_Y_TOLERANCE_MM,
  snapPointCoarse,
  snapRectCoarse,
  snapXFine,
  snapYFine,
  type SnapContext,
} from './snap';
import { PT, mmToPt, ptToMm } from './units';
import { DEFAULT_PAGE } from '../model/types';

const page = DEFAULT_PAGE; // 210 × 280, margins 18/24/15/13, gutter 4
const ctx = (cols: number, leadingPt = 12): SnapContext => ({ page, cols, leadingPt });

describe('units', () => {
  it('fixes PT at 0.3528 mm', () => {
    expect(PT).toBe(0.3528);
    expect(ptToMm(12)).toBeCloseTo(4.2336, 6);
    expect(mmToPt(ptToMm(9.5))).toBeCloseTo(9.5, 9);
  });
});

describe('coarse grid', () => {
  it('is pageW/6 × pageH/8', () => {
    expect(coarseCell(page)).toEqual({ wMm: 35, hMm: 35 });
  });

  it.each([
    [0, 0, 0, 0],
    [17, 17, 0, 0], // short of the half cell (17.5), rounds back
    [18, 18, 35, 35], // past it, rounds on
    [200, 200, 210, 210],
  ])('snaps (%s, %s) → (%s, %s)', (x, y, ex, ey) => {
    expect(snapPointCoarse({ x, y }, page)).toMatchObject({ x: ex, y: ey });
  });

  it('never produces a rect smaller than one cell', () => {
    const r = snapRectCoarse({ x: 10, y: 10 }, { x: 12, y: 12 }, page);
    expect(r.w).toBe(35);
    expect(r.h).toBe(35);
  });
});

describe('column geometry', () => {
  it('computes text width from the margins', () => {
    expect(columnWidthMm(page, 1)).toBe(210 - 15 - 13);
  });

  it.each([
    [1, 182],
    [2, (182 - 4) / 2],
    [3, (182 - 8) / 3],
    [4, (182 - 12) / 4],
    [6, (182 - 20) / 6],
  ])('%s columns → %s mm each', (cols, expected) => {
    expect(columnWidthMm(page, cols)).toBeCloseTo(expected, 9);
  });

  it('puts both margin boxes inside their own page', () => {
    const [left, right] = marginBoxes(page);
    expect(left!.x).toBe(13); // outside margin on the left page
    expect(right!.x).toBe(210 + 15); // inside margin on the right page
    expect(left!.h).toBe(280 - 18 - 24);
  });

  it('offers edges on both pages, sorted and unique', () => {
    const edges = columnEdges(page, 3);
    expect(edges).toEqual([...edges].sort((a, b) => a - b));
    expect(new Set(edges).size).toBe(edges.length);
    expect(edges).toContain(13); // left page, first column
    expect(edges).toContain(225); // right page, first column (210 + 15)
  });
});

describe('fine x snap — column / gutter edges within 3 mm', () => {
  it('fixes the tolerance at 3 mm', () => {
    expect(SNAP_X_TOLERANCE_MM).toBe(3);
  });

  it('takes an edge 2.9 mm away', () => {
    const r = snapXFine(13 + 2.9, ctx(3));
    expect(r.snapped).toBe(true);
    expect(r.value).toBe(13);
    expect(r.guideMm).toBe(13);
  });

  it('leaves an edge 3.1 mm away, rounding to 1 mm instead', () => {
    const r = snapXFine(100.4, ctx(3));
    expect(r.snapped).toBe(false);
    expect(r.value).toBe(100);
    expect(r.guideMm).toBeUndefined();
  });

  it('follows the column count: 4 columns snap where 3 do not', () => {
    const fourth = 13 + 3 * (columnWidthMm(page, 4) + 4);
    expect(snapXFine(fourth, ctx(4)).snapped).toBe(true);
    expect(snapXFine(fourth, ctx(3)).snapped).toBe(false);
  });

  it('only rounds when snapping is off', () => {
    const r = snapXFine(13.4, { ...ctx(3), enabled: false });
    expect(r.snapped).toBe(false);
    expect(r.value).toBe(13);
  });
});

describe('fine y snap — baselines within 2 mm', () => {
  it('fixes the tolerance at 2 mm', () => {
    expect(SNAP_Y_TOLERANCE_MM).toBe(2);
  });

  it('starts the grid at the top margin', () => {
    expect(baselines(page, 12)[0]).toBe(18);
  });

  it('steps by one leading', () => {
    const grid = baselines(page, 12);
    expect(grid[1]! - grid[0]!).toBeCloseTo(ptToMm(12), 3);
  });

  it('stops at the bottom margin', () => {
    expect(baselines(page, 12).at(-1)!).toBeLessThanOrEqual(280 - 24);
  });

  it('takes a baseline 1.9 mm away', () => {
    const r = snapYFine(18 + 1.9, ctx(3));
    expect(r.snapped).toBe(true);
    expect(r.value).toBe(18);
  });

  it('leaves a baseline 2.1 mm away', () => {
    const r = snapYFine(18 + 2.1, ctx(3));
    expect(r.snapped).toBe(false);
    expect(r.value).toBe(20);
  });

  it('follows the leading: the same y lands on a different baseline', () => {
    const at20 = baselines(page, 20)[1]!; // 18 + 20pt
    const probe = at20 + 0.5;
    expect(snapYFine(probe, ctx(3, 20)).value).toBeCloseTo(at20, 3);
    expect(snapYFine(probe, ctx(3, 12)).value).not.toBeCloseTo(at20, 3);
  });

  it('rounds to 1 mm below the last baseline, where nothing is near', () => {
    expect(FALLBACK_STEP_MM).toBe(1);
    const lastBaseline = baselines(page, 12).at(-1)!;
    const wayBelow = lastBaseline + SNAP_Y_TOLERANCE_MM + 5.6;
    const r = snapYFine(wayBelow, ctx(3));
    expect(r.snapped).toBe(false);
    expect(r.value).toBe(Math.round(wayBelow));
  });

  it('leaves a 0.23 mm dead band mid-pitch at body leading', () => {
    // A deliberate consequence of the §4.6 fixed points, pinned so nobody
    // "fixes" it later: at 12 pt the pitch is 4.2336 mm and the tolerance is
    // 2 mm, so 4 mm of every 4.2336 snaps and a hair in the middle does not.
    const pitch = ptToMm(12);
    const deadBand = pitch - 2 * SNAP_Y_TOLERANCE_MM;
    expect(deadBand).toBeCloseTo(0.2336, 4);

    expect(snapYFine(18 + 1.9, ctx(3)).snapped).toBe(true);
    expect(snapYFine(18 + pitch / 2, ctx(3)).snapped).toBe(false);
  });
});

/**
 * Kernel document model — SPEC.md §4.2.
 *
 * All geometry is millimetres in SPREAD SPACE: origin at the top-left of the
 * left page, x running across both pages (0 … 2 × page.wMm), y down one page
 * height (0 … page.hMm).
 *
 * The kernel has NO opinion about block types. `Block.type` is a registry key;
 * "body", "quote", "image" are plugin concepts (SPEC.md §7 B1).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
} // mm

export interface BlockBase {
  id: string;
  type: string;
  frame: Rect;
} // type = registry key

export interface TextAttrs {
  sizePt: number;
  leadingPt: number;
  align: 'left' | 'justify' | 'center';
}

export type Block = BlockBase & Partial<TextAttrs> & Record<string, unknown>;

export interface Spread {
  id: string;
  cols: number;
  blocks: Block[];
}

export interface PageSetup {
  wMm: number;
  hMm: number; // default 210 × 280
  margins: { top: number; bottom: number; inside: number; outside: number }; // 18/24/15/13
  columnGutterMm: number; // default 4
}

export interface DocumentV1 {
  schemaVersion: 1;
  id: string;
  title: string;
  updatedAt: number; // maintained by the bus
  page: PageSetup;
  spreads: Spread[];
}

/** Fixed points — SPEC.md §4.2, §4.3. */
export const DEFAULT_PAGE: PageSetup = {
  wMm: 210,
  hMm: 280,
  margins: { top: 18, bottom: 24, inside: 15, outside: 13 },
  columnGutterMm: 4,
};

export const MIN_BLOCK_W_MM = 14;
export const MIN_BLOCK_H_MM = 8;

export const DEFAULT_COLS = 3;
export const MIN_COLS = 1;
export const MAX_COLS = 12;

/** Spread space is two pages wide, one page tall. */
export function spreadWidthMm(page: PageSetup): number {
  return page.wMm * 2;
}
export function spreadHeightMm(page: PageSetup): number {
  return page.hMm;
}

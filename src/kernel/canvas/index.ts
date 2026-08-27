/**
 * Canvas primitives. SPEC.md §4.7 places the canvas host in the shell; the
 * paper primitives live in the kernel because BOTH B3 (flatplan) and B4
 * (spread editor) must render identical paper to interoperate — kernel
 * membership criterion (a) — and rule 2 of §4.5 forbids a plugin importing
 * from the shell. See docs/adr/001-kernel.md.
 */
export { SpreadPaper } from './SpreadPaper';
export type { SpreadPaperProps } from './SpreadPaper';
export { BlockLayer } from './BlockLayer';
export type { BlockLayerProps, BlockViewMode } from './BlockLayer';
export { OverlayLayer } from './OverlayLayer';
export type { OverlayLayerProps } from './OverlayLayer';

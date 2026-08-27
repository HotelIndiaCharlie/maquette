/**
 * Every number in the packet (docs/packets/blocks-basic.md §4), named once.
 * Views and tests both import from here — a number written twice disagrees
 * in three months (packet §4.0).
 */

/** Packet §4.1 — createDefault(frame) field values, per type. */
export const BODY_DEFAULT_SIZE_PT = 9.5;
export const BODY_DEFAULT_LEADING_PT = 12;
export const HEADLINE_DEFAULT_SIZE_PT = 38;
export const HEADLINE_DEFAULT_LEADING_PT = 40;
export const QUOTE_DEFAULT_SIZE_PT = 16;
export const QUOTE_DEFAULT_LEADING_PT = 20;

/** Packet §4.9 — Inspector bounds and step, shared by all three text types. */
export const SIZE_PT_MIN = 6;
export const SIZE_PT_MAX = 72;
export const LEADING_PT_MIN = 7;
export const LEADING_PT_MAX = 80;
export const PT_STEP = 0.5;

/** Packet §4.7 — the playground's two scales, in px per mm. */
export const FLATPLAN_SCALE = 0.55;
export const PLAYGROUND_FULL_SCALE = 3.0;

/** Packet §4.3 / §4.5 — quote rule inset from the frame edge, in mm. */
export const QUOTE_RULE_INSET_MM = 2;

/** Packet §4.4 — the FPO caption's size and its visibility floor, in px. */
export const FPO_CAPTION_SIZE_PT = 7;
export const FPO_MIN_PX = 5;

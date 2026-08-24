/**
 * zod schemas — SPEC.md §4.2. Validates on load (and validates every command
 * before it reaches a reducer, SPEC.md §4.3).
 */
import { z } from 'zod';
import type { Block, DocumentV1, PageSetup, Rect, Spread } from './types';
import { MAX_COLS, MIN_COLS } from './types';

const finite = z.number().finite();

export const rectSchema = z.object({
  x: finite,
  y: finite,
  w: finite.nonnegative(),
  h: finite.nonnegative(),
});

export const textAttrsSchema = z.object({
  sizePt: finite.positive().optional(),
  leadingPt: finite.positive().optional(),
  align: z.enum(['left', 'justify', 'center']).optional(),
});

/**
 * Blocks are open: a block type plugin may store any extra serialisable keys
 * on its own blocks. The kernel only guarantees id / type / frame and the
 * optional shared text attributes.
 */
export const blockSchema = z
  .looseObject({
    id: z.string().min(1),
    type: z.string().min(1),
    frame: rectSchema,
  })
  .and(textAttrsSchema.loose());

export const spreadSchema = z.object({
  id: z.string().min(1),
  cols: z.int().min(MIN_COLS).max(MAX_COLS),
  blocks: z.array(blockSchema),
});

export const pageSetupSchema = z.object({
  wMm: finite.positive(),
  hMm: finite.positive(),
  margins: z.object({
    top: finite.nonnegative(),
    bottom: finite.nonnegative(),
    inside: finite.nonnegative(),
    outside: finite.nonnegative(),
  }),
  columnGutterMm: finite.nonnegative(),
});

export const documentV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  updatedAt: finite,
  page: pageSetupSchema,
  spreads: z.array(spreadSchema),
});

/** Narrow the structurally-open zod output back onto the kernel types. */
export function parseDocument(input: unknown): DocumentV1 {
  return documentV1Schema.parse(input) as unknown as DocumentV1;
}

export function safeParseDocument(
  input: unknown,
): { ok: true; doc: DocumentV1 } | { ok: false; error: string } {
  const r = documentV1Schema.safeParse(input);
  return r.success
    ? { ok: true, doc: r.data as unknown as DocumentV1 }
    : { ok: false, error: z.prettifyError(r.error) };
}

export function parseBlock(input: unknown): Block {
  return blockSchema.parse(input) as unknown as Block;
}

export type ParsedRect = Rect;
export type ParsedSpread = Spread;
export type ParsedPageSetup = PageSetup;

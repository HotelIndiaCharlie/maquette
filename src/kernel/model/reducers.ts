/**
 * Pure reducers — SPEC.md §4.3. One function per command, unit-tested,
 * including clamping to spread bounds and the 14 × 8 mm minimum block size.
 *
 * Reducers never generate ids or read the clock: both arrive through
 * `ReduceContext`, so the whole function stays pure and table-testable.
 */
import { produce } from 'immer';
import type { Command } from '../commands/bus';
import type { Block, DocumentV1, PageSetup, Rect, Spread } from './types';
import {
  MAX_COLS,
  MIN_BLOCK_H_MM,
  MIN_BLOCK_W_MM,
  MIN_COLS,
  spreadHeightMm,
  spreadWidthMm,
} from './types';

export interface ReduceContext {
  /** Supplies ids for entities the command does not carry one for. */
  nextId: () => string;
}

export class KernelError extends Error {
  override name = 'KernelError';
}

/** Millimetres are stored at micron precision; keeps JSON and tests tidy. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Enforce the two kernel invariants on a frame: minimum size, and containment
 * within the spread. Size wins over position — a frame is never shrunk below
 * the minimum to make it fit, it is pushed back inside instead.
 */
export function normalizeFrame(frame: Rect, page: PageSetup): Rect {
  const maxW = spreadWidthMm(page);
  const maxH = spreadHeightMm(page);
  const w = clamp(frame.w, Math.min(MIN_BLOCK_W_MM, maxW), maxW);
  const h = clamp(frame.h, Math.min(MIN_BLOCK_H_MM, maxH), maxH);
  return {
    x: round3(clamp(frame.x, 0, maxW - w)),
    y: round3(clamp(frame.y, 0, maxH - h)),
    w: round3(w),
    h: round3(h),
  };
}

function findSpread(doc: DocumentV1, spreadId: string): Spread {
  const spread = doc.spreads.find((s) => s.id === spreadId);
  if (!spread) throw new KernelError(`unknown spread: ${spreadId}`);
  return spread;
}

/**
 * Apply one command. Returns the SAME document reference when the command is a
 * no-op (a patch on a block that no longer exists, say) so the bus can skip
 * the history push.
 */
export function reduce(doc: DocumentV1, cmd: Command, ctx: ReduceContext): DocumentV1 {
  switch (cmd.type) {
    case 'block/add':
      return produce(doc, (draft) => {
        const spread = findSpread(draft as DocumentV1, cmd.spreadId);
        if (spread.blocks.some((b) => b.id === cmd.block.id)) {
          throw new KernelError(`duplicate block id: ${cmd.block.id}`);
        }
        spread.blocks.push({
          ...cmd.block,
          frame: normalizeFrame(cmd.block.frame, draft.page),
        } as Block);
      });

    case 'block/update':
      return produce(doc, (draft) => {
        const spread = findSpread(draft as DocumentV1, cmd.spreadId);
        const block = spread.blocks.find((b) => b.id === cmd.blockId);
        if (!block) return; // no-op: block is gone
        const { id: _ignoredId, ...patch } = cmd.patch as Partial<Block> & { id?: string };
        Object.assign(block, patch);
        if (patch.frame) block.frame = normalizeFrame(patch.frame as Rect, draft.page);
      });

    case 'block/remove':
      return produce(doc, (draft) => {
        const spread = findSpread(draft as DocumentV1, cmd.spreadId);
        const i = spread.blocks.findIndex((b) => b.id === cmd.blockId);
        if (i < 0) return; // no-op: already gone
        spread.blocks.splice(i, 1);
      });

    case 'spread/add':
      return produce(doc, (draft) => {
        const last = draft.spreads[draft.spreads.length - 1];
        draft.spreads.push({
          id: ctx.nextId(),
          cols: last ? last.cols : 3,
          blocks: [],
        });
      });

    case 'spread/update':
      return produce(doc, (draft) => {
        const spread = findSpread(draft as DocumentV1, cmd.spreadId);
        if (cmd.patch.cols !== undefined) {
          const cols = Math.round(cmd.patch.cols);
          if (!Number.isFinite(cols)) throw new KernelError('cols must be finite');
          spread.cols = clamp(cols, MIN_COLS, MAX_COLS);
        }
      });

    case 'doc/update':
      return produce(doc, (draft) => {
        if (cmd.patch.title !== undefined) draft.title = cmd.patch.title;
        if (cmd.patch.page !== undefined) {
          draft.page = { ...draft.page, ...cmd.patch.page };
          // Page geometry changed: every frame must be re-contained.
          for (const spread of draft.spreads) {
            for (const block of spread.blocks) {
              block.frame = normalizeFrame(block.frame as Rect, draft.page);
            }
          }
        }
      });
  }
}

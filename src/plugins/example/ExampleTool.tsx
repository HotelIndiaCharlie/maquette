/**
 * A tool — SPEC.md §4.4, §4.6, and CLAUDE.md §4.
 *
 * THE RULE THIS FILE DEMONSTRATES: **one command per completed gesture.** The
 * drag lives in local module state and previews there; exactly one command
 * reaches the bus, on pointer-up. Every plugin's tests assert this by measuring
 * the log length across a gesture.
 */
import type { PluginContext, Rect, SpreadPointerEvent, ToolDef } from '@/kernel';
import { MIN_BLOCK_H_MM, MIN_BLOCK_W_MM, snapPointCoarse } from '@/kernel';
import { exampleBlockType } from './ExampleBlock';

export function createExampleTool(ctx: PluginContext): ToolDef {
  // Gesture state is LOCAL. It is not the document, so it never goes near the
  // bus and never goes near storage (CLAUDE.md §4, §5).
  let start: { x: number; y: number } | null = null;

  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    // The kernel clamps to these in `normalizeFrame` regardless; doing it here
    // too means the ghost preview shows what will actually be created.
    w: Math.max(MIN_BLOCK_W_MM, Math.abs(b.x - a.x)),
    h: Math.max(MIN_BLOCK_H_MM, Math.abs(b.y - a.y)),
  });

  return {
    id: 'example-draw',
    label: 'Draw example',
    // A ReactNode. Kept as text here so the reference plugin pulls in no icon
    // dependency; a real tool uses a lucide icon.
    icon: <span aria-hidden="true">▭</span>,
    layer: 'both',

    // Handlers receive a SpreadPointerEvent — `{ mm, spreadId, raw }`, already
    // in spread-space millimetres. Tools NEVER see client coordinates: the
    // canvas surface converts with `toSpreadPoint` and the kernel routes with
    // `forwardPointer` (§4.6).
    onDown(e: SpreadPointerEvent) {
      start = snapPointCoarse(e.mm, ctx.bus.getDocument().page);
    },

    onMove() {
      // A real tool renders a ghost preview here, from local state only.
      // Nothing is dispatched mid-gesture.
    },

    onUp(e: SpreadPointerEvent) {
      if (!start) return;
      const doc = ctx.bus.getDocument();
      const end = snapPointCoarse(e.mm, doc.page);
      const frame = rectFrom(start, end);
      start = null;

      // ── THE ONLY DOOR TO MUTATION ──────────────────────────────────────
      // `ctx.bus.dispatch` stamps `source: 'example'` on the log entry, so the
      // log always names who asked. The bare `dispatch` export stamps
      // 'kernel' and destroys attribution — never use it from a plugin.
      // ONE command, at the END of the gesture (CLAUDE.md §4).
      ctx.bus.dispatch({
        type: 'block/add',
        spreadId: e.spreadId,
        block: exampleBlockType.createDefault(frame),
      });

      // A gesture that genuinely needs SEVERAL commands wraps them instead:
      //   ctx.bus.transact('Draw example', () => { … });
      // — one undo step, one log group, rolled back whole if it throws.
    },
  };
}

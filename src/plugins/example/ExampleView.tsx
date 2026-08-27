/**
 * A view — SPEC.md §4.4. It owns a route, and it renders PAPER.
 *
 * `SpreadPaper`, `BlockLayer` and `OverlayLayer` are KERNEL exports, not shell
 * ones. SPEC.md §4.7 puts the canvas host in the shell, but B3 and B4 must
 * render identical paper and a plugin may not import the shell — so the paper
 * primitives live in `kernel/canvas`. This is documented deviation #1; see
 * docs/adr/001-kernel.md and docs/plugin-api.md §0.
 */
import type { ViewDef } from '@/kernel';
import { SpreadPaper, useDocument, useSelection } from '@/kernel';

/** Flatplan cards run at ≈0.55 px/mm (SPEC.md §7 B3). */
const FLATPLAN_SCALE = 0.55;

export const ExampleView: ViewDef['View'] = () => {
  const doc = useDocument();
  const selection = useSelection();
  const spread = doc.spreads[0];

  if (!spread) return null;

  return (
    <div className="flex h-full items-center justify-center p-6">
      {/*
        SpreadPaper renders GEOMETRY only: white paper two pages wide and one
        page tall, shadow-paper, the centre gutter hairline — then it mounts
        the registered Mini/Full views and overlays for us. It knows spreads
        have size; it does not know what is on them (§4.7).
      */}
      <SpreadPaper
        spread={spread}
        page={doc.page}
        scale={FLATPLAN_SCALE}
        mode="mini"
        layer="flatplan"
        selectedIds={selection.blockIds}
      />
    </div>
  );
};

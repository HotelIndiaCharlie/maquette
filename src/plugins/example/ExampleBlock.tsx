/**
 * A block type — SPEC.md §4.4. The pattern B1's four types follow.
 *
 * MiniView is Layer 1 (flatplan card, greeked shapes). FullView is Layer 2
 * (spread editor, real type at real size). Both receive `{ block, scale }` and
 * render INSIDE a box the kernel's BlockLayer has already positioned, sized
 * from the model, and set to overflow:hidden — so fill it (`size-full`) and
 * never position yourself.
 */
import type { Block, BlockTypeDef, Rect } from '@/kernel';
import { greek, newId, ptToPx } from '@/kernel';

/** SPEC.md §7-style fixed points. A packet states every one of these (§6.2). */
const DEFAULT_SIZE_PT = 9.5;
const DEFAULT_LEADING_PT = 12;
/** Below this many px a hairline is sub-pixel: we hide it rather than alias it. */
const MIN_LEGIBLE_PX = 1;

/**
 * `createDefault(frame)` must return a COMPLETE Block: id, type, frame, plus
 * whatever attributes this type owns. `newId` is the kernel's only id source.
 * The reducer runs `normalizeFrame` on block/add, so a frame slightly out of
 * bounds is corrected rather than rejected.
 */
function createDefault(frame: Rect): Block {
  return {
    id: newId('example'),
    type: 'example',
    frame,
    // `TextAttrs` is the shared shape the kernel knows about. A block may also
    // carry its OWN extra serialisable keys — `Block` is
    // `BlockBase & Partial<TextAttrs> & Record<string, unknown>` and
    // `blockSchema` is a looseObject, so they survive save/load. That is the
    // ONE exception to CLAUDE.md §5: data that IS the block belongs on the
    // block; everything else is a sidecar.
    sizePt: DEFAULT_SIZE_PT,
    leadingPt: DEFAULT_LEADING_PT,
    align: 'left',
  };
}

function attrs(block: Block) {
  return {
    sizePt: typeof block.sizePt === 'number' ? block.sizePt : DEFAULT_SIZE_PT,
    leadingPt: typeof block.leadingPt === 'number' ? block.leadingPt : DEFAULT_LEADING_PT,
  };
}

/**
 * Layer 1 — greeked. Bars, not text: the flatplan is about rhythm and mass.
 *
 * `scale` is px per mm and the flatplan runs at ≈0.55, so every dimension here
 * is checked against MIN_LEGIBLE_PX. A packet must state this per element
 * (template part 4.3): hide, floor, or accept.
 */
const MiniView: BlockTypeDef['MiniView'] = ({ block, scale }) => {
  const { leadingPt } = attrs(block);
  // Bar pitch follows the leading, so a change of leading visibly changes the
  // texture of the card. Geometry from the model → INLINE style, never a class
  // (ADR-005). `ptToPx(pt, scale)` is the only correct pt → px conversion.
  const pitchPx = ptToPx(leadingPt, scale);
  const barPx = Math.max(MIN_LEGIBLE_PX, pitchPx * 0.5);
  const rows = pitchPx > 0 ? Math.max(1, Math.floor((block.frame.h * scale) / pitchPx)) : 1;

  return (
    <div className="size-full overflow-hidden" data-example-mini>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          // Only tokens carry colour. `greek` and `greek-dark` are the ONLY two
          // greeking values that exist in tokens.css — a third is a review
          // failure, and adding one is a change outside this folder (§3).
          className="bg-greek"
          style={{ height: barPx, marginBottom: Math.max(0, pitchPx - barPx) }}
        />
      ))}
    </div>
  );
};

/**
 * Layer 2 — typographic. Real greeked words at the real point size.
 *
 * NOTE ON FIDELITY (SPEC.md §4.10): this renders greeked shapes at a size, and
 * shows the reader NOTHING derived from `measure()` — no fill %, no overflow
 * state, no line count. So `FidelityBadge` is not required here. The moment a
 * surface displays a measured number, the badge becomes mandatory.
 */
const FullView: BlockTypeDef['FullView'] = ({ block, scale }) => {
  const { sizePt, leadingPt } = attrs(block);
  const align = block.align === 'justify' || block.align === 'center' ? block.align : 'left';
  // Deterministic greeking: the same word count always yields the same words,
  // so the layout does not shimmer between renders (§4.10).
  const words = Math.max(1, Math.round((block.frame.w * block.frame.h) / 90));

  return (
    <div
      className="size-full overflow-hidden font-serif-body text-ink"
      style={{
        fontSize: ptToPx(sizePt, scale),
        lineHeight: `${ptToPx(leadingPt, scale)}px`,
        textAlign: align,
      }}
    >
      {greek(words)}
    </div>
  );
};

/**
 * The Inspector fragment. B1 owns the FRAGMENT; B5 owns the panel that hosts
 * it and finds it via `ctx.registry.blockTypes.get(type)?.Inspector` — read
 * access on the registry is how one plugin composes with another's
 * contribution WITHOUT importing it (ADR-003).
 */
const Inspector: NonNullable<BlockTypeDef['Inspector']> = ({ block }) => (
  <p className="font-ui text-micro text-ink-soft">
    {block.type} · {attrs(block).sizePt}/{attrs(block).leadingPt} pt
  </p>
);

export const exampleBlockType: BlockTypeDef = {
  id: 'example',
  label: 'Example',
  createDefault,
  MiniView,
  FullView,
  Inspector,
};

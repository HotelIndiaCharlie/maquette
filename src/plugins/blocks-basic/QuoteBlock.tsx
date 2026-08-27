/**
 * The quote block type — packet §4.1–§4.3. Two 1 px hairline rules, inset
 * `QUOTE_RULE_INSET_MM` from the frame's top and bottom edges, floored to
 * 1 px at every scale (§4.4 — structure, not texture). Greeked mid-tone bars
 * sit between the rules on Layer 1; an italic line sits between them,
 * vertically centred, on Layer 2 — both layers read as the same object.
 */
import type { Block, BlockTypeDef, PluginContext, Rect } from '@/kernel';
import { greek, newId, ptToPx } from '@/kernel';
import { GreekBars } from './GreekBars';
import { createTypeInspector } from './TypeInspector';
import { QUOTE_DEFAULT_LEADING_PT, QUOTE_DEFAULT_SIZE_PT, QUOTE_RULE_INSET_MM } from './constants';

/** The fixed word count for the quote's greeked line — packet §4.3. */
const QUOTE_WORDS = 7;

/** Exported so `PlaygroundView` builds its demo block from the same default (packet §4.7). */
export function createQuoteDefault(frame: Rect): Block {
  return {
    id: newId('quote'),
    type: 'quote',
    frame,
    sizePt: QUOTE_DEFAULT_SIZE_PT,
    leadingPt: QUOTE_DEFAULT_LEADING_PT,
    align: 'left',
  };
}

function readAttrs(block: Block) {
  return {
    sizePt: typeof block.sizePt === 'number' ? block.sizePt : QUOTE_DEFAULT_SIZE_PT,
    leadingPt: typeof block.leadingPt === 'number' ? block.leadingPt : QUOTE_DEFAULT_LEADING_PT,
    align: block.align === 'justify' || block.align === 'center' ? block.align : ('left' as const),
  };
}

/** The two hairlines, shared between both layers so they read as one object. */
function QuoteRules({ insetPx }: { insetPx: number }) {
  return (
    <>
      <div className="absolute inset-x-0 bg-border-hairline" style={{ top: insetPx, height: 1 }} />
      <div className="absolute inset-x-0 bg-border-hairline" style={{ bottom: insetPx, height: 1 }} />
    </>
  );
}

const MiniView: BlockTypeDef['MiniView'] = ({ block, scale }) => {
  const { leadingPt } = readAttrs(block);
  const insetPx = QUOTE_RULE_INSET_MM * scale;
  const barsHeightMm = Math.max(0, block.frame.h - 2 * QUOTE_RULE_INSET_MM);

  return (
    <div className="relative size-full overflow-hidden">
      <QuoteRules insetPx={insetPx} />
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: insetPx, bottom: insetPx }}>
        <GreekBars leadingPt={leadingPt} frameHeightMm={barsHeightMm} scale={scale} tone="mid" />
      </div>
    </div>
  );
};

const FullView: BlockTypeDef['FullView'] = ({ block, scale }) => {
  const { sizePt, leadingPt, align } = readAttrs(block);
  const insetPx = QUOTE_RULE_INSET_MM * scale;

  return (
    <div className="relative size-full overflow-hidden">
      <QuoteRules insetPx={insetPx} />
      <div
        className="absolute inset-x-0 flex items-center overflow-hidden font-serif-body text-ink italic"
        style={{
          top: insetPx,
          bottom: insetPx,
          fontSize: ptToPx(sizePt, scale),
          lineHeight: `${ptToPx(leadingPt, scale)}px`,
        }}
      >
        <span className="w-full" style={{ textAlign: align }}>
          {greek(QUOTE_WORDS)}
        </span>
      </div>
    </div>
  );
};

export function createQuoteBlockType(ctx: PluginContext): BlockTypeDef {
  return {
    id: 'quote',
    label: 'Quote',
    createDefault: createQuoteDefault,
    MiniView,
    FullView,
    // Quote stores `align` (§4.1) but exposes no control for it (§4.6).
    Inspector: createTypeInspector(ctx, {
      defaultSizePt: QUOTE_DEFAULT_SIZE_PT,
      defaultLeadingPt: QUOTE_DEFAULT_LEADING_PT,
      showAlignToggle: false,
    }),
  };
}

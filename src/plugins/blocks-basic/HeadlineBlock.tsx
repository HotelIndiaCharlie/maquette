/**
 * The headline block type — packet §4.1–§4.3. Greeked dark bars on Layer 1;
 * bold sans (`font-ui`) on Layer 2 — the one place UI type appears on paper,
 * per the resolved conflict in packet §4.10.
 */
import type { Block, BlockTypeDef, PluginContext, Rect } from '@/kernel';
import { newId, ptToPx } from '@/kernel';
import { GreekBars } from './GreekBars';
import { createTypeInspector } from './TypeInspector';
import { HEADLINE_DEFAULT_LEADING_PT, HEADLINE_DEFAULT_SIZE_PT } from './constants';

/** The literal headline copy — packet §4.3. Not greeked: it is real, fixed text. */
const HEADLINE_TEXT = 'The shape of the page';

/** Exported so `PlaygroundView` builds its demo block from the same default (packet §4.7). */
export function createHeadlineDefault(frame: Rect): Block {
  return {
    id: newId('headline'),
    type: 'headline',
    frame,
    sizePt: HEADLINE_DEFAULT_SIZE_PT,
    leadingPt: HEADLINE_DEFAULT_LEADING_PT,
    align: 'left',
  };
}

function readAttrs(block: Block) {
  return {
    sizePt: typeof block.sizePt === 'number' ? block.sizePt : HEADLINE_DEFAULT_SIZE_PT,
    leadingPt:
      typeof block.leadingPt === 'number' ? block.leadingPt : HEADLINE_DEFAULT_LEADING_PT,
    align: block.align === 'justify' || block.align === 'center' ? block.align : ('left' as const),
  };
}

const MiniView: BlockTypeDef['MiniView'] = ({ block, scale }) => {
  const { leadingPt } = readAttrs(block);
  return <GreekBars leadingPt={leadingPt} frameHeightMm={block.frame.h} scale={scale} tone="dark" />;
};

const FullView: BlockTypeDef['FullView'] = ({ block, scale }) => {
  const { sizePt, leadingPt, align } = readAttrs(block);

  return (
    <div
      className="size-full overflow-hidden font-ui font-bold text-ink"
      style={{
        fontSize: ptToPx(sizePt, scale),
        lineHeight: `${ptToPx(leadingPt, scale)}px`,
        textAlign: align,
      }}
    >
      {HEADLINE_TEXT}
    </div>
  );
};

export function createHeadlineBlockType(ctx: PluginContext): BlockTypeDef {
  return {
    id: 'headline',
    label: 'Headline',
    createDefault: createHeadlineDefault,
    MiniView,
    FullView,
    // Headline stores `align` (§4.1) but exposes no control for it (§4.6).
    Inspector: createTypeInspector(ctx, {
      defaultSizePt: HEADLINE_DEFAULT_SIZE_PT,
      defaultLeadingPt: HEADLINE_DEFAULT_LEADING_PT,
      showAlignToggle: false,
    }),
  };
}

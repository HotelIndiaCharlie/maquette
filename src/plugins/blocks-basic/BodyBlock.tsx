/**
 * The body block type — packet §4.1–§4.3. Greeked light bars on Layer 1;
 * real Georgia body copy, filled with `wordsToFill`, on Layer 2.
 */
import type { Block, BlockTypeDef, PluginContext, Rect } from '@/kernel';
import { greek, newId, ptToPx, wordsToFill } from '@/kernel';
import { GreekBars } from './GreekBars';
import { createTypeInspector } from './TypeInspector';
import { BODY_DEFAULT_LEADING_PT, BODY_DEFAULT_SIZE_PT } from './constants';

/** Exported so `PlaygroundView` builds its demo block from the same default (packet §4.7). */
export function createBodyDefault(frame: Rect): Block {
  return {
    id: newId('body'),
    type: 'body',
    frame,
    sizePt: BODY_DEFAULT_SIZE_PT,
    leadingPt: BODY_DEFAULT_LEADING_PT,
    align: 'left',
  };
}

/** Every view tolerates a missing or non-numeric attribute (packet §4.1). */
function readAttrs(block: Block) {
  return {
    sizePt: typeof block.sizePt === 'number' ? block.sizePt : BODY_DEFAULT_SIZE_PT,
    leadingPt: typeof block.leadingPt === 'number' ? block.leadingPt : BODY_DEFAULT_LEADING_PT,
    align: block.align === 'justify' || block.align === 'center' ? block.align : ('left' as const),
  };
}

const MiniView: BlockTypeDef['MiniView'] = ({ block, scale }) => {
  const { leadingPt } = readAttrs(block);
  return <GreekBars leadingPt={leadingPt} frameHeightMm={block.frame.h} scale={scale} tone="light" />;
};

const FullView: BlockTypeDef['FullView'] = ({ block, scale }) => {
  const { sizePt, leadingPt, align } = readAttrs(block);
  const words = wordsToFill(block.frame.w, block.frame.h, { sizePt, leadingPt, align });

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

export function createBodyBlockType(ctx: PluginContext): BlockTypeDef {
  return {
    id: 'body',
    label: 'Body',
    createDefault: createBodyDefault,
    MiniView,
    FullView,
    Inspector: createTypeInspector(ctx, {
      defaultSizePt: BODY_DEFAULT_SIZE_PT,
      defaultLeadingPt: BODY_DEFAULT_LEADING_PT,
      showAlignToggle: true,
    }),
  };
}

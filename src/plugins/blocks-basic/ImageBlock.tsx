/**
 * The image block type — packet §4.5. No text attributes at all: no
 * `sizePt`, `leadingPt` or `align`. Both layers render the same box; only
 * `scale` differs, which is why one `ImageBox` serves both `MiniView` and
 * `FullView`.
 */
import type { Block, BlockTypeDef, Rect } from '@/kernel';
import { newId, ptToPx } from '@/kernel';
import { FPO_CAPTION_SIZE_PT, FPO_MIN_PX } from './constants';

/** Exported so `PlaygroundView` builds its demo block from the same default (packet §4.7). */
export function createImageDefault(frame: Rect): Block {
  return { id: newId('image'), type: 'image', frame };
}

function ImageBox({ scale }: { scale: number }) {
  const captionPx = ptToPx(FPO_CAPTION_SIZE_PT, scale);
  const showCaption = captionPx >= FPO_MIN_PX;

  return (
    <div className="relative size-full overflow-hidden border border-border-hairline bg-greek">
      {/* `vectorEffect="non-scaling-stroke"` keeps the 1 px floor honest
          through the viewBox scaling (§4.4, §4.5). */}
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          className="stroke-greek-dark"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          className="stroke-greek-dark"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Document type sized from a pt value is inline, not the text-micro
          class — the resolved conflict in packet §4.10. Hidden below FPO_MIN_PX. */}
      {showCaption && (
        <span
          className="absolute inset-0 flex items-center justify-center font-ui text-ink-soft"
          style={{ fontSize: captionPx }}
        >
          FPO
        </span>
      )}
    </div>
  );
}

const MiniView: BlockTypeDef['MiniView'] = ({ scale }) => <ImageBox scale={scale} />;
const FullView: BlockTypeDef['FullView'] = ({ scale }) => <ImageBox scale={scale} />;

/**
 * [CALL] §7 asks for an Inspector fragment on every type; image has no text
 * attrs. A one-line fragment satisfies that literally and stops B5 from
 * showing an unexplained empty area (packet §4.5). Reversal: register no
 * `Inspector` at all.
 */
const Inspector: NonNullable<BlockTypeDef['Inspector']> = () => (
  <p className="font-ui text-micro text-ink-soft">No type attributes.</p>
);

export const imageBlockType: BlockTypeDef = {
  id: 'image',
  label: 'Image',
  createDefault: createImageDefault,
  MiniView,
  FullView,
  Inspector,
};

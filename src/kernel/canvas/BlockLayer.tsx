/**
 * Block layer — mounts registered Mini/Full views onto paper.
 *
 * The host knows spreads have size; it does NOT know what is on them
 * (SPEC.md §4.7). Everything here is driven by the blockTypes registry, so a
 * document containing a type no plugin provides degrades to a visible
 * placeholder instead of a crash.
 *
 * Geometry is inline style computed from the model — never a class (§3).
 */
import type { CSSProperties } from 'react';
import type { Block, Rect, Spread } from '../model/types';
import { blockTypes } from '../registry';
import { useRegistry } from '../registry/hooks';

export type BlockViewMode = 'mini' | 'full';

export interface BlockLayerProps {
  spread: Spread;
  scale: number; // px per mm
  mode: BlockViewMode;
  selectedIds?: ReadonlyArray<string>;
}

function frameStyle(frame: Rect, scale: number): CSSProperties {
  return {
    position: 'absolute',
    left: frame.x * scale,
    top: frame.y * scale,
    width: frame.w * scale,
    height: frame.h * scale,
  };
}

export function BlockLayer({ spread, scale, mode, selectedIds = [] }: BlockLayerProps) {
  const defs = useRegistry(blockTypes);

  return (
    <>
      {spread.blocks.map((block) => {
        const def = defs.find((d) => d.id === block.type);
        const selected = selectedIds.includes(block.id);
        const View = def ? (mode === 'mini' ? def.MiniView : def.FullView) : null;

        return (
          <div
            key={block.id}
            data-block-id={block.id}
            data-block-type={block.type}
            data-selected={selected || undefined}
            style={frameStyle(block.frame as Rect, scale)}
            className={
              'overflow-hidden' +
              (selected ? ' outline outline-1 outline-offset-0 outline-mark' : '')
            }
          >
            {View ? <View block={block} scale={scale} /> : <UnknownBlock block={block} />}
          </div>
        );
      })}
    </>
  );
}

function UnknownBlock({ block }: { block: Block }) {
  return (
    <div
      title={`No plugin provides block type "${block.type}"`}
      className="flex size-full items-center justify-center border border-dashed border-guide bg-guide-soft"
    >
      <span className="font-ui text-micro tracking-wide text-ink-soft">{block.type}</span>
    </div>
  );
}

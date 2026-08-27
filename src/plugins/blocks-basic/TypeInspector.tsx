/**
 * The shared size/leading slider pair, plus an optional align toggle —
 * packet §4.6. `BlockTypeDef.Inspector` is `FC<{block, spreadId}>` with no
 * callback slot, so this fragment owns its own commit behaviour, and
 * `ctx.bus.transact` is synchronous so a transaction cannot be held open
 * across a drag. Both constraints are why the commit rule below is what it
 * is — see docs/plugin-api.md §4 and packet §4.6.
 *
 * `createTypeInspector(ctx, config)` closes over `ctx` at register time (the
 * same factory pattern `src/plugins/example/ExamplePanel.tsx` uses) and
 * returns a component matching `BlockTypeDef['Inspector']` exactly, so B5 can
 * call it with nothing but `{ block, spreadId }`.
 */
import { useEffect, useState } from 'react';
import type { Block, PluginContext } from '@/kernel';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  LEADING_PT_MAX,
  LEADING_PT_MIN,
  PT_STEP,
  SIZE_PT_MAX,
  SIZE_PT_MIN,
} from './constants';

type Align = 'left' | 'justify' | 'center';

export interface TypeInspectorConfig {
  defaultSizePt: number;
  defaultLeadingPt: number;
  /** Body only (packet §4.6). Headline and quote store `align` but expose no control. */
  showAlignToggle: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundStep(n: number): number {
  return Math.round(n / PT_STEP) * PT_STEP;
}

/**
 * The no-op guard, packet §4.6: "a commit equal to the current value
 * dispatches nothing." Exported standalone because Radix's own `Slider`
 * already suppresses an `onValueCommit` call when a drag nets back to its
 * start value — this guard is defense-in-depth for a commit that reaches the
 * handler some other way, and is otherwise unreachable through the widget
 * itself, which makes it awkward to prove through a rendered gesture alone.
 */
export function resolveCommit(current: number, next: number): number | null {
  const rounded = roundStep(next);
  return rounded === current ? null : rounded;
}

/** Missing/NaN falls back to the type's default; a stored value is clamped on read (§4.9). */
function readSizePt(block: Block, fallback: number): number {
  return typeof block.sizePt === 'number' && Number.isFinite(block.sizePt)
    ? clamp(block.sizePt, SIZE_PT_MIN, SIZE_PT_MAX)
    : fallback;
}

function readLeadingPt(block: Block, fallback: number): number {
  return typeof block.leadingPt === 'number' && Number.isFinite(block.leadingPt)
    ? clamp(block.leadingPt, LEADING_PT_MIN, LEADING_PT_MAX)
    : fallback;
}

function readAlign(block: Block): Align {
  return block.align === 'justify' || block.align === 'center' ? block.align : 'left';
}

export function createTypeInspector(ctx: PluginContext, config: TypeInspectorConfig) {
  const { defaultSizePt, defaultLeadingPt, showAlignToggle } = config;

  return function TypeInspector({ block, spreadId }: { block: Block; spreadId: string }) {
    const sizePt = readSizePt(block, defaultSizePt);
    const leadingPt = readLeadingPt(block, defaultLeadingPt);
    const align = readAlign(block);

    // Local preview state, live during the drag. Nothing reaches the bus
    // until release — the block on paper does not move until then (§4.6).
    const [sizePreview, setSizePreview] = useState(sizePt);
    const [leadingPreview, setLeadingPreview] = useState(leadingPt);

    useEffect(() => {
      // The block prop changed identity — undo, or another surface's edit.
      // Resync the preview from the document (§4.6).
      setSizePreview(sizePt);
      setLeadingPreview(leadingPt);
    }, [block, sizePt, leadingPt]);

    const commitSize = (next: number) => {
      const resolved = resolveCommit(sizePt, next);
      if (resolved === null) return;
      ctx.bus.dispatch({
        type: 'block/update',
        spreadId,
        blockId: block.id,
        patch: { sizePt: resolved },
      });
    };

    const commitLeading = (next: number) => {
      const resolved = resolveCommit(leadingPt, next);
      if (resolved === null) return;
      ctx.bus.dispatch({
        type: 'block/update',
        spreadId,
        blockId: block.id,
        patch: { leadingPt: resolved },
      });
    };

    const commitAlign = (next: string) => {
      if (next !== 'left' && next !== 'justify' && next !== 'center') return; // Radix emits '' on deselect
      if (next === align) return;
      ctx.bus.dispatch({
        type: 'block/update',
        spreadId,
        blockId: block.id,
        patch: { align: next },
      });
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${block.id}-size`}>Size — {sizePreview} pt</Label>
          <Slider
            id={`${block.id}-size`}
            min={SIZE_PT_MIN}
            max={SIZE_PT_MAX}
            step={PT_STEP}
            value={[sizePreview]}
            onValueChange={([v]) => v !== undefined && setSizePreview(roundStep(v))}
            onValueCommit={([v]) => v !== undefined && commitSize(v)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${block.id}-leading`}>Leading — {leadingPreview} pt</Label>
          <Slider
            id={`${block.id}-leading`}
            min={LEADING_PT_MIN}
            max={LEADING_PT_MAX}
            step={PT_STEP}
            value={[leadingPreview]}
            onValueChange={([v]) => v !== undefined && setLeadingPreview(roundStep(v))}
            onValueCommit={([v]) => v !== undefined && commitLeading(v)}
          />
        </div>
        {showAlignToggle && (
          <div className="flex flex-col gap-1">
            <Label>Align</Label>
            <ToggleGroup type="single" value={align} onValueChange={commitAlign}>
              <ToggleGroupItem value="left">Left</ToggleGroupItem>
              <ToggleGroupItem value="justify">Justify</ToggleGroupItem>
              <ToggleGroupItem value="center">Centre</ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>
    );
  };
}

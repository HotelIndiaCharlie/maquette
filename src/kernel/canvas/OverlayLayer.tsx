/**
 * Overlay layer — mounts registered overlays above paper, by layer and zIndex
 * (SPEC.md §4.4, §4.7).
 *
 * Overlays are guides by default: the layer does not take pointer events. An
 * overlay that is an affordance (B4's red resize handle) re-enables them on its
 * own element with `pointer-events-auto`.
 */
import type { Layer } from '../registry/types';
import { overlays } from '../registry';
import { useRegistry } from '../registry/hooks';

export interface OverlayLayerProps {
  spreadId: string;
  scale: number;
  layer: Exclude<Layer, 'both'>;
}

export function OverlayLayer({ spreadId, scale, layer }: OverlayLayerProps) {
  const defs = useRegistry(overlays);
  const mine = defs
    .filter((d) => d.layer === layer || d.layer === 'both')
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <>
      {mine.map((def) => (
        <div
          key={def.id}
          data-overlay-id={def.id}
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: def.zIndex }}
        >
          <def.View spreadId={spreadId} scale={scale} />
        </div>
      ))}
    </>
  );
}

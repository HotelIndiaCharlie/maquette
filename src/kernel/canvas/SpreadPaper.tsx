/**
 * Paper — the brightest object on the desk (SPEC.md §3).
 *
 * Renders spread geometry ONLY: a white rectangle two pages wide and one page
 * tall, `shadow-paper`, and the centre gutter hairline. Then it mounts the
 * registered block views and overlays. It has no opinion about content
 * (SPEC.md §4.7).
 */
import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';
import { forwardRef } from 'react';
import type { PageSetup, Spread } from '../model/types';
import { spreadHeightMm, spreadWidthMm } from '../model/types';
import { BlockLayer, type BlockViewMode } from './BlockLayer';
import { OverlayLayer } from './OverlayLayer';

export interface SpreadPaperProps {
  spread: Spread;
  page: PageSetup;
  /** px per mm. */
  scale: number;
  mode: BlockViewMode;
  layer: 'flatplan' | 'spread';
  selectedIds?: ReadonlyArray<string>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: PointerEventHandler<HTMLDivElement>;
}

export const SpreadPaper = forwardRef<HTMLDivElement, SpreadPaperProps>(function SpreadPaper(
  {
    spread,
    page,
    scale,
    mode,
    layer,
    selectedIds,
    className,
    style,
    children,
    ...handlers
  }: SpreadPaperProps,
  ref,
) {
  const width = spreadWidthMm(page) * scale;
  const height = spreadHeightMm(page) * scale;

  return (
    <div
      ref={ref}
      data-spread-id={spread.id}
      data-layer={layer}
      className={`relative bg-paper shadow-paper${className ? ` ${className}` : ''}`}
      style={{ width, height, ...style }}
      {...handlers}
    >
      {/* centre gutter hairline — geometry, so inline from the model */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 bottom-0 w-px bg-border-hairline"
        style={{ left: page.wMm * scale }}
      />
      <BlockLayer spread={spread} scale={scale} mode={mode} {...(selectedIds ? { selectedIds } : {})} />
      <OverlayLayer spreadId={spread.id} scale={scale} layer={layer} />
      {children}
    </div>
  );
});

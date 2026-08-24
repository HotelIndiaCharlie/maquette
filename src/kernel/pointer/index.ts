/**
 * Pointer normalisation — SPEC.md §4.6.
 *
 * Tools never see raw client coordinates. The kernel turns a PointerEvent on a
 * canvas surface into `{ mm, spreadId, raw }` in spread space. In this
 * prototype only a mouse arrives; `raw` is carried so pen and touch can be
 * added later without touching a single tool.
 */
export interface SpreadPointerEvent {
  mm: { x: number; y: number };
  spreadId: string;
  raw: PointerEvent;
}

export interface SurfaceRect {
  left: number;
  top: number;
}

/**
 * @param scale px per mm of the surface (mini card scale, or viewport.scale())
 * @param origin px position of spread-space (0,0) inside the surface element
 */
export function toSpreadPoint(
  raw: PointerEvent,
  surface: { element: Element; scale: number; spreadId: string; origin?: { x: number; y: number } },
): SpreadPointerEvent {
  const rect = surface.element.getBoundingClientRect();
  const origin = surface.origin ?? { x: 0, y: 0 };
  return {
    mm: {
      x: (raw.clientX - rect.left - origin.x) / surface.scale,
      y: (raw.clientY - rect.top - origin.y) / surface.scale,
    },
    spreadId: surface.spreadId,
    raw,
  };
}

/** Pure form, for tests and for callers that already have the rect. */
export function clientToMm(
  client: { x: number; y: number },
  rect: SurfaceRect,
  scale: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  return {
    x: (client.x - rect.left - origin.x) / scale,
    y: (client.y - rect.top - origin.y) / scale,
  };
}

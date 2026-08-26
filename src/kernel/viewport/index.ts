/**
 * Viewport — SPEC.md §4.6. The mm ↔ screen transform for the spread stage,
 * plus zoom and pan state.
 *
 * ONE instance. §4.6 says "per spread-editor instance"; this prototype shows at
 * most one spread editor at a time, so the kernel owns a single viewport that
 * the editor configures on mount and resets on unmount. See ADR-001.
 */
import { createStore } from 'zustand/vanilla';
import type { Dispose } from '../dispose';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4.0;

export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  /** px per mm at zoom === 1 (the fit scale the stage computed). */
  baseScale: number;
  zoom: number;
  /** Screen px position of spread-space (0,0), relative to the stage element. */
  origin: Point;
}

export interface ViewportApi {
  mmToScreen(p: Point): Point;
  screenToMm(p: Point): Point;
  scale(): number; // px per mm
  zoom(): number;
  setZoom(z: number, aroundScreenPt?: Point): void; // 0.5–4.0
  subscribe(cb: (state: ViewportState) => void): Dispose;
}

const INITIAL: ViewportState = { baseScale: 1, zoom: 1, origin: { x: 0, y: 0 } };

const store = createStore<ViewportState>(() => INITIAL);

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function currentScale(s: ViewportState): number {
  return s.baseScale * s.zoom;
}

export const viewport: ViewportApi & {
  state(): ViewportState;
  setBaseScale(scale: number): void;
  setOrigin(origin: Point): void;
  panBy(dxPx: number, dyPx: number): void;
  reset(): void;
} = {
  mmToScreen(p) {
    const s = store.getState();
    const k = currentScale(s);
    return { x: s.origin.x + p.x * k, y: s.origin.y + p.y * k };
  },
  screenToMm(p) {
    const s = store.getState();
    const k = currentScale(s);
    return { x: (p.x - s.origin.x) / k, y: (p.y - s.origin.y) / k };
  },
  scale: () => currentScale(store.getState()),
  zoom: () => store.getState().zoom,

  /**
   * Zoom about a screen point: the mm coordinate under `aroundScreenPt` is the
   * one that must not move (Ctrl/Cmd+wheel around the cursor, §7 B4).
   */
  setZoom(z, aroundScreenPt) {
    const s = store.getState();
    const next = clampZoom(z);
    if (next === s.zoom) return;
    if (!aroundScreenPt) {
      store.setState({ zoom: next });
      return;
    }
    const anchorMm = {
      x: (aroundScreenPt.x - s.origin.x) / currentScale(s),
      y: (aroundScreenPt.y - s.origin.y) / currentScale(s),
    };
    const k = s.baseScale * next;
    store.setState({
      zoom: next,
      origin: { x: aroundScreenPt.x - anchorMm.x * k, y: aroundScreenPt.y - anchorMm.y * k },
    });
  },

  subscribe: (cb) => store.subscribe((s) => cb(s)),

  state: () => store.getState(),
  setBaseScale: (scale) => {
    if (scale > 0 && scale !== store.getState().baseScale) store.setState({ baseScale: scale });
  },
  setOrigin: (origin) => {
    const s = store.getState();
    if (s.origin.x !== origin.x || s.origin.y !== origin.y) store.setState({ origin });
  },
  panBy: (dxPx, dyPx) => {
    const s = store.getState();
    store.setState({ origin: { x: s.origin.x + dxPx, y: s.origin.y + dyPx } });
  },
  reset: () => store.setState(INITIAL, true),
};

export const viewportStore = store;

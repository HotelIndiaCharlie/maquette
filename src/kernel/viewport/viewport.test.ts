/** Viewport transform — SPEC.md §4.6. */
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, viewport } from './index';
import { clientToMm, toSpreadPoint } from '../pointer';

beforeEach(() => {
  viewport.reset();
});

describe('mm ↔ screen', () => {
  it('round-trips at any zoom', () => {
    viewport.setBaseScale(2);
    viewport.setOrigin({ x: 30, y: 40 });
    viewport.setZoom(1.5);

    const mm = { x: 123.4, y: 56.7 };
    const back = viewport.screenToMm(viewport.mmToScreen(mm));
    expect(back.x).toBeCloseTo(mm.x, 9);
    expect(back.y).toBeCloseTo(mm.y, 9);
  });

  it('reports scale as baseScale × zoom', () => {
    viewport.setBaseScale(3);
    viewport.setZoom(2);
    expect(viewport.scale()).toBe(6);
  });
});

describe('zoom', () => {
  it('clamps to 50–400%', () => {
    expect(MIN_ZOOM).toBe(0.5);
    expect(MAX_ZOOM).toBe(4);

    viewport.setZoom(99);
    expect(viewport.zoom()).toBe(4);
    viewport.setZoom(0.01);
    expect(viewport.zoom()).toBe(0.5);
  });

  it('keeps the mm point under the cursor fixed', () => {
    viewport.setBaseScale(2);
    viewport.setOrigin({ x: 0, y: 0 });

    const cursor = { x: 400, y: 300 };
    const before = viewport.screenToMm(cursor);
    viewport.setZoom(2, cursor);
    const after = viewport.screenToMm(cursor);

    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('ignores a non-finite zoom', () => {
    viewport.setZoom(Number.NaN);
    expect(viewport.zoom()).toBe(1);
  });

  it('pans by screen pixels', () => {
    viewport.panBy(10, -5);
    expect(viewport.state().origin).toEqual({ x: 10, y: -5 });
  });
});

describe('pointer normalisation', () => {
  it('turns client coordinates into spread mm', () => {
    expect(clientToMm({ x: 120, y: 80 }, { left: 20, top: 30 }, 2)).toEqual({ x: 50, y: 25 });
  });

  it('accounts for an origin offset inside the surface', () => {
    expect(clientToMm({ x: 120, y: 80 }, { left: 20, top: 30 }, 2, { x: 10, y: 10 })).toEqual({
      x: 45,
      y: 20,
    });
  });

  it('carries the raw event through for pen and touch later', () => {
    const element = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }) as DOMRect,
    } as unknown as Element;
    const raw = { clientX: 100, clientY: 50 } as PointerEvent;

    const e = toSpreadPoint(raw, { element, scale: 0.5, spreadId: 'spread_2' });
    expect(e).toEqual({ mm: { x: 200, y: 100 }, spreadId: 'spread_2', raw });
  });
});

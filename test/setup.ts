import 'fake-indexeddb/auto';

/**
 * jsdom implements neither `ResizeObserver` nor pointer capture. Every
 * vendored Radix primitive that measures its own size (`@/components/ui/
 * slider`, at minimum) throws `ResizeObserver is not defined` the instant a
 * plugin test renders it, and any pointer-driven gesture on one throws
 * `target.hasPointerCapture is not a function` the instant a `pointerdown`
 * reaches it. Both are jsdom-environment gaps, not anything a plugin's own
 * code can route around, so they are stubbed once, here, for every test file
 * rather than by each plugin that discovers them (docs/adr/006, "Amendments
 * from implementing B1").
 */
// Some kernel tests (`// @vitest-environment node`, e.g. test/boundaries.test.ts,
// test/plugin-api-version.test.ts) run without a DOM at all — guard every stub.
if (typeof globalThis.ResizeObserver === 'undefined' && typeof HTMLElement !== 'undefined') {
  class StubResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = StubResizeObserver;
}

if (typeof HTMLElement !== 'undefined' && !('setPointerCapture' in HTMLElement.prototype)) {
  Object.assign(HTMLElement.prototype, {
    setPointerCapture(): void {},
    hasPointerCapture(): boolean {
      return true;
    },
    releasePointerCapture(): void {},
  });
}

/** React 18's `act()` warns unless this is set — true for every test file, not just ones using it. */
if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

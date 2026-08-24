/**
 * Canvas host — SPEC.md §4.7. The desk: a warm light-grey surface that holds
 * whatever view a plugin registered for this route, and nothing else.
 *
 * The paper primitives the views draw on (SpreadPaper, BlockLayer,
 * OverlayLayer) are kernel exports, because two plugins must share them and a
 * plugin may not import from the shell — see docs/adr/001-kernel.md.
 */
import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ToolRail } from './ToolRail';

export function CanvasHost({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex-1 overflow-auto bg-desk">
      <ErrorBoundary label="This view">{children}</ErrorBoundary>
      <ToolRail />
    </main>
  );
}

/**
 * What the desk shows with zero plugins loaded — the Lot 0 litmus test
 * (SPEC.md §2): empty shell, empty document, placeholder view.
 */
export function PlaceholderView() {
  return (
    <div
      data-testid="placeholder-view"
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div className="h-24 w-36 border border-border-hairline bg-paper shadow-paper" aria-hidden="true" />
      <h1 className="font-ui text-sm font-medium text-ink">No plugins loaded</h1>
      <p className="font-ui text-xs leading-relaxed text-ink-soft">
        The kernel is up: document, command bus, registries, storage and the job
        seam are all running. Every visible function is a plugin — add one to{' '}
        <code className="font-ui text-ink">src/shell/plugins.ts</code> to make the
        application appear.
      </p>
    </div>
  );
}

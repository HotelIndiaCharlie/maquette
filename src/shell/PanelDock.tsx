/**
 * Panel dock — SPEC.md §4.4/§4.7: right rail at ≥760px, bottom sheet below.
 * Renders the panels registry in `order`. The inspector is a plugin like any
 * other; with none loaded the dock does not exist.
 */
import { panels, useRegistry } from '@/kernel';
import { ErrorBoundary } from './ErrorBoundary';
import { useIsWide } from './useLayer';

export function PanelDock() {
  const wide = useIsWide();
  const defs = useRegistry(panels)
    .filter((p) => (p.visible ? p.visible() : true))
    .slice()
    .sort((a, b) => a.order - b.order);

  if (defs.length === 0) return null;

  return (
    <aside
      data-testid="panel-dock"
      className={
        wide
          ? 'w-72 shrink-0 overflow-y-auto border-l border-border-hairline bg-surface'
          : 'max-h-sheet shrink-0 overflow-y-auto border-t border-border-hairline bg-surface'
      }
    >
      {defs.map((panel) => (
        <section key={panel.id} className="border-b border-border-hairline p-3 last:border-b-0">
          <h2 className="mb-2 font-ui text-label tracking-caps text-ink-soft uppercase">
            {panel.title}
          </h2>
          <ErrorBoundary label={`Panel “${panel.title}”`}>
            <panel.View />
          </ErrorBoundary>
        </section>
      ))}
    </aside>
  );
}

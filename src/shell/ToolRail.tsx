/**
 * Tool rail — SPEC.md §4.7: bottom-centre, renders the tools registry as a
 * shadcn Toggle Group. The shell does not know what any tool does; it only
 * knows which one is active (kernel `activeTool`).
 */
import { activeTool, tools, useActiveTool, useRegistry } from '@/kernel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCurrentLayer } from './useLayer';

export function ToolRail() {
  const layer = useCurrentLayer();
  const defs = useRegistry(tools).filter((t) => t.layer === layer || t.layer === 'both');
  const current = useActiveTool();

  if (defs.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <ToggleGroup
        type="single"
        value={current ?? ''}
        onValueChange={(v) => activeTool.set(v || null)}
        aria-label="Tools"
        className="pointer-events-auto rounded-tool border border-border-hairline bg-surface p-1 shadow-paper"
      >
        {defs.map((tool) => (
          <ToggleGroupItem
            key={tool.id}
            value={tool.id}
            aria-label={tool.label}
            title={tool.label}
            className="min-h-hit min-w-hit"
          >
            {tool.icon}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

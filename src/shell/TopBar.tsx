/**
 * Top bar — SPEC.md §4.7: name, breadcrumb, undo/redo, env badge.
 * Near-white chrome, 1px hairlines, quiet UI type (§3).
 */
import { Link, useLocation } from 'react-router-dom';
import { Redo2, Undo2 } from 'lucide-react';
import { redo, undo, useDocument, useHistoryState } from '@/kernel';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function useBreadcrumb(): string[] {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return ['Flatplan'];
  return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export function TopBar() {
  const doc = useDocument();
  const history = useHistoryState();
  const crumbs = useBreadcrumb();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-hairline bg-surface px-3">
      <Link
        to="/"
        className="font-ui text-xs font-semibold tracking-wordmark text-ink uppercase"
      >
        Maquette
      </Link>

      <Separator orientation="vertical" className="h-4" />

      <nav aria-label="Breadcrumb" className="flex items-baseline gap-1.5 truncate">
        <span className="font-ui text-xs text-ink">{doc.title}</span>
        {crumbs.map((c) => (
          <span key={c} className="font-ui text-xs text-ink-soft">
            / {c}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Undo"
          title="Undo"
          disabled={!history.canUndo}
          onClick={() => undo()}
        >
          <Undo2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Redo"
          title="Redo"
          disabled={!history.canRedo}
          onClick={() => redo()}
        >
          <Redo2 className="size-4" aria-hidden="true" />
        </Button>

        <span
          data-testid="env-badge"
          className="ml-1 rounded-tool border border-border-hairline px-1.5 py-0.5 font-ui text-micro tracking-wide text-ink-soft"
        >
          {import.meta.env.DEV ? 'local' : 'preview'}
        </span>
      </div>
    </header>
  );
}

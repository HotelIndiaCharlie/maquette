import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { boot } from './boot';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelDock } from './PanelDock';
import { AppRoutes } from './routes';
import { TopBar } from './TopBar';
import { useIsWide } from './useLayer';

export function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    boot()
      .then(() => alive && setReady(true))
      .catch((err: unknown) => {
        console.error('[maquette] boot failed', err);
        if (alive) setBootError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col bg-desk">
          <TopBar />
          <Shell ready={ready} bootError={bootError} />
        </div>
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  );
}

function Shell({ ready, bootError }: { ready: boolean; bootError: Error | null }) {
  const wide = useIsWide();

  if (bootError) {
    return (
      <div className="m-6 max-w-lg rounded-tool border border-mark bg-mark-soft p-4">
        <p className="font-ui text-sm font-medium text-ink">Maquette could not start.</p>
        <p className="mt-1 font-ui text-xs text-ink-soft">{bootError.message}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div data-testid="booting" className="flex flex-1 items-center justify-center bg-desk">
        <span className="font-ui text-xs text-ink-soft">Opening the desk…</span>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 ${wide ? 'flex-row' : 'flex-col'}`}>
      <ErrorBoundary label="The desk">
        <AppRoutes />
      </ErrorBoundary>
      <PanelDock />
    </div>
  );
}

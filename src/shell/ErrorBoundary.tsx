/**
 * A broken plugin disables itself at load (SPEC.md §4.5). This catches the
 * other case — a plugin component that throws while rendering — so the desk
 * survives rather than going white.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[maquette] ${this.props.label ?? 'render'} failed`, error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="m-6 max-w-lg rounded-tool border border-mark bg-mark-soft p-4">
        <p className="font-ui text-sm font-medium text-ink">
          {this.props.label ?? 'This view'} stopped rendering.
        </p>
        <p className="mt-1 font-ui text-xs text-ink-soft">{error.message}</p>
      </div>
    );
  }
}

/**
 * Undo / redo — SPEC.md §4.3.
 *
 * Snapshot based: immer gives the document structural sharing, so holding whole
 * document references per step is cheap and makes undo exact. One entry per
 * completed gesture (§4.3) or per `transact` group (§4.9 ChangeSets, P3, P4).
 */
export const MAX_HISTORY_DEPTH = 200;

export interface HistoryStep<T> {
  doc: T;
  label: string;
}

export class History<T> {
  private past: HistoryStep<T>[] = [];
  private future: HistoryStep<T>[] = [];
  private listeners = new Set<() => void>();

  /** Record the state that existed BEFORE the change that is about to land. */
  push(before: T, label: string): void {
    this.past.push({ doc: before, label });
    if (this.past.length > MAX_HISTORY_DEPTH) this.past.shift();
    this.future = [];
    this.notify();
  }

  undo(current: T): HistoryStep<T> | null {
    const step = this.past.pop();
    if (!step) return null;
    this.future.push({ doc: current, label: step.label });
    this.notify();
    return step;
  }

  redo(current: T): HistoryStep<T> | null {
    const step = this.future.pop();
    if (!step) return null;
    this.past.push({ doc: current, label: step.label });
    this.notify();
    return step;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }
  canRedo(): boolean {
    return this.future.length > 0;
  }
  undoLabel(): string | null {
    return this.past[this.past.length - 1]?.label ?? null;
  }
  redoLabel(): string | null {
    return this.future[this.future.length - 1]?.label ?? null;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.notify();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

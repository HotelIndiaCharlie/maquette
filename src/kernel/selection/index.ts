/**
 * Selection — SPEC.md §4.6. Kernel-owned because every layer agrees on it:
 * the flatplan outlines it, the spread editor handles it, the inspector edits
 * it, the delete tool consumes it. Criterion (a): plugins must share it.
 */
import { createStore } from 'zustand/vanilla';
import type { Dispose } from '../dispose';
import { getDocument, subscribeDoc } from '../commands/bus';

export interface SelectionState {
  blockIds: string[];
  spreadId: string | null;
}

export interface SelectionApi {
  get(): SelectionState;
  set(sel: SelectionState): void;
  clear(): void;
  subscribe(cb: (sel: SelectionState) => void): Dispose;
}

const EMPTY: SelectionState = { blockIds: [], spreadId: null };

const store = createStore<SelectionState>(() => EMPTY);

function sameSelection(a: SelectionState, b: SelectionState): boolean {
  return (
    a.spreadId === b.spreadId &&
    a.blockIds.length === b.blockIds.length &&
    a.blockIds.every((id, i) => id === b.blockIds[i])
  );
}

export const selection: SelectionApi = {
  get: () => store.getState(),
  set: (sel) => {
    const next: SelectionState = { blockIds: [...sel.blockIds], spreadId: sel.spreadId };
    if (!sameSelection(store.getState(), next)) store.setState(next, true);
  },
  clear: () => {
    if (!sameSelection(store.getState(), EMPTY)) store.setState(EMPTY, true);
  },
  subscribe: (cb) => store.subscribe((s) => cb(s)),
};

/**
 * Keep the selection truthful: blocks removed by any command (or by an undo)
 * drop out of it, so no plugin ever has to defend against a ghost id.
 */
subscribeDoc((doc) => {
  const current = store.getState();
  if (current.blockIds.length === 0 && current.spreadId === null) return;

  const spread = current.spreadId ? doc.spreads.find((s) => s.id === current.spreadId) : undefined;
  if (current.spreadId && !spread) {
    store.setState(EMPTY, true);
    return;
  }
  const live = spread ? new Set(spread.blocks.map((b) => b.id)) : new Set<string>();
  const kept = current.blockIds.filter((id) => live.has(id));
  if (kept.length !== current.blockIds.length) {
    store.setState({ blockIds: kept, spreadId: current.spreadId }, true);
  }
});

/** Convenience for the common single-block case. */
export function selectOnly(spreadId: string, blockId: string): void {
  selection.set({ spreadId, blockIds: [blockId] });
}

export function isSelected(blockId: string): boolean {
  return store.getState().blockIds.includes(blockId);
}

export function __resetSelectionForTests(): void {
  store.setState(EMPTY, true);
}

/** Test/derivation helper — the doc is the source of truth for what exists. */
export function selectedBlocks() {
  const { spreadId, blockIds } = store.getState();
  if (!spreadId) return [];
  const spread = getDocument().spreads.find((s) => s.id === spreadId);
  if (!spread) return [];
  return spread.blocks.filter((b) => blockIds.includes(b.id));
}

export const selectionStore = store;

/**
 * The active tool — kernel because the shell's tool rail (which renders the
 * registry) and the canvas surfaces (which plugins render) must agree on which
 * tool receives pointer events, without importing each other.
 * Kernel membership criterion (a). See docs/adr/003-plugin-contract.md.
 */
import { createStore } from 'zustand/vanilla';
import type { Dispose } from '../dispose';
import type { SpreadPointerEvent } from '../pointer';
import { tools } from './index';
import type { Layer } from './types';

interface ActiveToolState {
  id: string | null;
}

const store = createStore<ActiveToolState>(() => ({ id: null }));

export interface ActiveToolApi {
  get(): string | null;
  set(id: string | null): void;
  subscribe(cb: (id: string | null) => void): Dispose;
}

export const activeTool: ActiveToolApi = {
  get: () => store.getState().id,
  set: (id) => {
    if (store.getState().id !== id) store.setState({ id });
  },
  subscribe: (cb) => store.subscribe((s) => cb(s.id)),
};

export const activeToolStore = store;

function servesLayer(defLayer: Layer, layer: Exclude<Layer, 'both'>): boolean {
  return defLayer === layer || defLayer === 'both';
}

/**
 * Forward a kernel-normalised pointer event to the active tool, if that tool
 * serves this layer. Returns true when a tool handled it.
 */
export function forwardPointer(
  phase: 'down' | 'move' | 'up',
  e: SpreadPointerEvent,
  layer: Exclude<Layer, 'both'>,
): boolean {
  const id = activeTool.get();
  if (!id) return false;
  const def = tools.get(id);
  if (!def || !servesLayer(def.layer, layer)) return false;

  const handler = phase === 'down' ? def.onDown : phase === 'move' ? def.onMove : def.onUp;
  if (!handler) return false;
  handler(e);
  return true;
}

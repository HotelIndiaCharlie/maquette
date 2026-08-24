import { useSyncExternalStore } from 'react';
import { activeToolStore } from './activeTool';

export function useActiveTool(): string | null {
  return useSyncExternalStore(
    (cb) => activeToolStore.subscribe(cb),
    () => activeToolStore.getState().id,
    () => activeToolStore.getState().id,
  );
}

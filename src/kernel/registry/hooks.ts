import { useSyncExternalStore } from 'react';
import type { Registry } from './types';

/** Re-render a shell slot when its registry changes. */
export function useRegistry<T extends { id: string }>(registry: Registry<T>): ReadonlyArray<T> {
  return useSyncExternalStore(
    (onChange) => registry.subscribe(() => onChange()),
    () => registry.list(),
    () => registry.list(),
  );
}

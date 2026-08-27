import { useSyncExternalStore } from 'react';
import { viewportStore, type ViewportState } from './index';

export function useViewport(): ViewportState {
  return useSyncExternalStore(
    (cb) => viewportStore.subscribe(cb),
    () => viewportStore.getState(),
    () => viewportStore.getState(),
  );
}

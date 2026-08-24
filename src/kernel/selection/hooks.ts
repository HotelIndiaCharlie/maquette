import { useSyncExternalStore } from 'react';
import { selectionStore, type SelectionState } from './index';

export function useSelection(): SelectionState {
  return useSyncExternalStore(
    (cb) => selectionStore.subscribe(cb),
    () => selectionStore.getState(),
    () => selectionStore.getState(),
  );
}

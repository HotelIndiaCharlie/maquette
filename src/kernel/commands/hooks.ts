import { useSyncExternalStore } from 'react';
import { canRedo, canUndo, getLog, subscribeHistory, subscribeLog } from './bus';
import type { LogEntry } from './log';

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

let snapshot: HistoryState = { canUndo: false, canRedo: false };

function readHistory(): HistoryState {
  if (snapshot.canUndo !== canUndo() || snapshot.canRedo !== canRedo()) {
    snapshot = { canUndo: canUndo(), canRedo: canRedo() };
  }
  return snapshot;
}

export function useHistoryState(): HistoryState {
  return useSyncExternalStore(subscribeHistory, readHistory, readHistory);
}

export function useCommandLog(): ReadonlyArray<LogEntry> {
  return useSyncExternalStore(subscribeLog, getLog, getLog);
}

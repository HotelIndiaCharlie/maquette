import { useSyncExternalStore } from 'react';
import { getDocument, subscribeDoc } from '../commands/bus';
import type { DocumentV1, Spread } from './types';

export function useDocument(): DocumentV1 {
  return useSyncExternalStore(subscribeDoc, getDocument, getDocument);
}

export function useSpread(spreadId: string | null | undefined): Spread | undefined {
  const doc = useDocument();
  return spreadId ? doc.spreads.find((s) => s.id === spreadId) : undefined;
}

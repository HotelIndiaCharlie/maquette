/**
 * Autosave — SPEC.md §4.8: any command debounces (500 ms) `save()`.
 * The bus is the only thing that can change the document, so subscribing to it
 * is the only subscription autosave needs.
 */
import { subscribeDoc } from '../commands/bus';
import type { StorageAdapter } from './types';

export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface AutosaveHandle {
  stop(): void;
  /** Write immediately (beforeunload, or a test that will not wait). */
  flush(): Promise<void>;
}

export function startAutosave(
  adapter: StorageAdapter,
  opts: { debounceMs?: number; onError?: (err: unknown) => void } = {},
): AutosaveHandle {
  const debounceMs = opts.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Parameters<StorageAdapter['save']>[0] | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const write = () => {
    const doc = pending;
    pending = null;
    timer = null;
    if (!doc) return;
    inFlight = adapter.save(doc).catch((err) => {
      opts.onError?.(err);
    });
  };

  const unsubscribe = subscribeDoc((doc) => {
    pending = doc;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  });

  return {
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      unsubscribe();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        write();
      }
      await inFlight;
    },
  };
}

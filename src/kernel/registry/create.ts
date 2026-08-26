import type { Registry } from './types';

export class DuplicateRegistrationError extends Error {
  override name = 'DuplicateRegistrationError';
}

/**
 * One registry, five instances. Registration order is preserved (the tool rail
 * and panel dock sort deliberately; everything else reads in load order).
 * Duplicate id = hard error at load — SPEC.md §4.4.
 */
export function createRegistry<T extends { id: string }>(kind: string): Registry<T> {
  let defs: ReadonlyArray<T> = [];
  const listeners = new Set<(defs: ReadonlyArray<T>) => void>();

  const notify = () => {
    for (const l of listeners) l(defs);
  };

  return {
    register(def) {
      if (defs.some((d) => d.id === def.id)) {
        throw new DuplicateRegistrationError(`${kind}: duplicate id "${def.id}"`);
      }
      defs = [...defs, def];
      notify();
      return () => {
        const next = defs.filter((d) => d.id !== def.id);
        if (next.length === defs.length) return;
        defs = next;
        notify();
      };
    },
    list: () => defs,
    get: (id) => defs.find((d) => d.id === id),
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

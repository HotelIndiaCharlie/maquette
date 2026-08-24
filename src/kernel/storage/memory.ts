/** In-memory adapters — used by tests and by any "no persistence" boot. */
import type { DocumentV1 } from '../model/types';
import type { DocumentSummary, SidecarStore, StorageAdapter } from './types';

export function createMemoryAdapter(): StorageAdapter {
  const docs = new Map<string, DocumentV1>();
  return {
    async load(id) {
      const d = docs.get(id);
      return d ? (JSON.parse(JSON.stringify(d)) as DocumentV1) : null;
    },
    async save(doc) {
      docs.set(doc.id, JSON.parse(JSON.stringify(doc)) as DocumentV1);
    },
    async list() {
      return [...docs.values()]
        .map((d): DocumentSummary => ({ id: d.id, title: d.title, updatedAt: d.updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async remove(id) {
      docs.delete(id);
    },
  };
}

/** A shared flat space, so namespacing can be asserted the way IndexedDB sees it. */
export function createMemorySidecarSpace() {
  const space = new Map<string, unknown>();
  return {
    space,
    factoryFor(pluginId: string) {
      return <T>(namespace: string): SidecarStore<T> => {
        const prefix = `${pluginId}:${namespace}:`;
        return {
          async get(key) {
            const v = space.get(prefix + key);
            return v === undefined ? null : (v as T);
          },
          async set(key, v) {
            space.set(prefix + key, v);
          },
          async list(keyPrefix) {
            return [...space.keys()]
              .filter((k) => k.startsWith(prefix))
              .map((k) => k.slice(prefix.length))
              .filter((k) => (keyPrefix ? k.startsWith(keyPrefix) : true))
              .sort();
          },
          async remove(key) {
            space.delete(prefix + key);
          },
        };
      };
    },
  };
}

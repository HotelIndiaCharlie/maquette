/**
 * IndexedDB adapters — SPEC.md §4.8, the M0 storage. Two object stores in one
 * database: documents, and the flat sidecar key/value space.
 *
 * Plugins NEVER reach IndexedDB or localStorage directly (CLAUDE.md §5);
 * they receive a namespaced `SidecarStore` and nothing else.
 */
import { createStore, del, entries, get, keys, set } from 'idb-keyval';
import type { DocumentV1 } from '../model/types';
import { migrate } from '../model/migrate';
import type { DocumentSummary, SidecarStore, StorageAdapter } from './types';

// idb-keyval's createStore() provisions a database holding exactly ONE object
// store, so documents and sidecars get a database each. Sharing a name would
// leave whichever store lost the upgrade race permanently missing.
const documentsStore = createStore('maquette-documents', 'documents');
const sidecarStore = createStore('maquette-sidecar', 'sidecar');

export const indexedDbAdapter: StorageAdapter = {
  async load(id) {
    const raw = await get(id, documentsStore);
    if (raw === undefined) return null;
    return migrate(raw);
  },
  async save(doc) {
    // Structured clone cannot carry frozen immer drafts' proxies; plain JSON
    // round-trip keeps the stored document exactly what `migrate` will accept.
    await set(doc.id, JSON.parse(JSON.stringify(doc)) as DocumentV1, documentsStore);
  },
  async list() {
    const all = await entries<string, DocumentV1>(documentsStore);
    return all
      .map(([, doc]): DocumentSummary => ({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async remove(id) {
    await del(id, documentsStore);
  },
};

/** Namespaced sidecar. Full key = `${pluginId}:${namespace}:${key}`. */
export function createSidecar<T>(pluginId: string, namespace: string): SidecarStore<T> {
  if (!pluginId) throw new Error('sidecar requires a pluginId');
  if (!namespace) throw new Error('sidecar requires a namespace');
  const prefix = `${pluginId}:${namespace}:`;
  const full = (key: string) => `${prefix}${key}`;

  return {
    async get(key) {
      const v = await get<T>(full(key), sidecarStore);
      return v === undefined ? null : v;
    },
    async set(key, v) {
      await set(full(key), v, sidecarStore);
    },
    async list(keyPrefix) {
      const all = await keys<string>(sidecarStore);
      return all
        .filter((k) => typeof k === 'string' && k.startsWith(prefix))
        .map((k) => k.slice(prefix.length))
        .filter((k) => (keyPrefix ? k.startsWith(keyPrefix) : true))
        .sort();
    },
    async remove(key) {
      await del(full(key), sidecarStore);
    },
  };
}

/** `ctx.storage` for one plugin: a factory bound to that plugin's id. */
export function sidecarFactoryFor(pluginId: string) {
  return <T>(namespace: string): SidecarStore<T> => createSidecar<T>(pluginId, namespace);
}

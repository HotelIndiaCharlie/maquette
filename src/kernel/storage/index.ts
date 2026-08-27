export type { StorageAdapter, SidecarStore, SidecarFactory, DocumentSummary } from './types';
export { indexedDbAdapter, createSidecar, sidecarFactoryFor } from './indexeddb';
export { createMemoryAdapter, createMemorySidecarSpace } from './memory';
export { startAutosave, AUTOSAVE_DEBOUNCE_MS } from './autosave';
export type { AutosaveHandle } from './autosave';

/** Storage seam — SPEC.md §4.8. */
import type { DocumentV1 } from '../model/types';

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface StorageAdapter {
  // documents
  load(id: string): Promise<DocumentV1 | null>;
  save(doc: DocumentV1): Promise<void>;
  list(): Promise<DocumentSummary[]>;
  remove(id: string): Promise<void>;
}

export interface SidecarStore<T> {
  // plugin data — key prefix `${pluginId}:${ns}`
  get(key: string): Promise<T | null>;
  set(key: string, v: T): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  remove(key: string): Promise<void>;
}

/** What a plugin receives as `ctx.storage` (SPEC.md §4.5). */
export type SidecarFactory = <T>(namespace: string) => SidecarStore<T>;

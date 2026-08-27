/**
 * Schema migration — SPEC.md §4.2: identity for v1.
 *
 * Rule (CLAUDE.md §2): a schema change = version bump + migration + ADR + tests.
 * Add the next step here; `migrate` must always return the current version.
 */
import type { DocumentV1 } from './types';
import { parseDocument } from './schema';

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** Anything that has ever been persisted. Today: only v1. */
export type AnyDocument = DocumentV1;

export function migrate(input: unknown): DocumentV1 {
  const raw = input as { schemaVersion?: unknown } | null | undefined;
  const version = raw && typeof raw === 'object' ? raw.schemaVersion : undefined;

  switch (version) {
    case 1:
      return parseDocument(input); // identity
    default:
      throw new Error(`unsupported schemaVersion: ${String(version)}`);
  }
}

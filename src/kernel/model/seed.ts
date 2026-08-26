/**
 * Documents the kernel can boot with. The kernel seeds GEOMETRY only — three
 * empty spreads on default page setup. It cannot seed content: block types are
 * a plugin concept (SPEC.md §4.2), so with zero plugins loaded the seed and the
 * empty document look identical, which is exactly the Lot 0 litmus test (§2).
 */
import type { DocumentV1, Spread } from './types';
import { DEFAULT_PAGE } from './types';

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDocument(title = 'Untitled maquette'): DocumentV1 {
  return {
    schemaVersion: 1,
    id: newId('doc'),
    title,
    updatedAt: Date.now(),
    page: { ...DEFAULT_PAGE, margins: { ...DEFAULT_PAGE.margins } },
    spreads: [],
  };
}

/** Three spreads, column counts 3 / 2 / 3 (reference/maquette.html). */
export function createSeedDocument(title = 'Untitled maquette'): DocumentV1 {
  const cols = [3, 2, 3];
  const spreads: Spread[] = cols.map((c, i) => ({
    id: `spread_${i + 1}`,
    cols: c,
    blocks: [],
  }));
  return { ...createEmptyDocument(title), spreads };
}

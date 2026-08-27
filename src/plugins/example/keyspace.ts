/**
 * The sidecar keyspace — packet part 5, SPEC.md §4.8.
 *
 * Kept in its own module so the manifest and the panel can share it without an
 * import cycle. A packet names every namespace, every key and every value
 * shape, or the word "none".
 */

/** `ctx.storage(PREFS_NAMESPACE)` → keys prefixed `example:prefs` by the kernel. */
export const PREFS_NAMESPACE = 'prefs';

/** The one key inside that namespace. */
export const PREFS_KEY = 'panel';

export interface ExamplePrefs {
  blocksAdded: number;
}

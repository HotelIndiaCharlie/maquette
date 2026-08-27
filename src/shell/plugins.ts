/**
 * THE LOAD LIST — SPEC.md §4.5.
 *
 * Built-ins first, then probes. Adding a feature is ONE line here plus its
 * folder in src/plugins/. Removing a feature is deleting that line and that
 * folder; the app must still compile and run (CLAUDE.md §3).
 *
 * Flag-gated entries are skipped at load, so probes stay dark until asked for.
 *
 * Lot 0: empty. The kernel with zero plugins boots — that is the litmus test
 * (SPEC.md §2).
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  `src/plugins/example/` IS DELIBERATELY ABSENT FROM THIS LIST.        │
 * │  It is the permanent reference plugin: compiled and boundary-linted   │
 * │  on every CI run so `pnpm new:plugin` scaffolds from something        │
 * │  guaranteed to build against the real kernel — but it is a teaching   │
 * │  artefact, not a feature, so it must never load.                      │
 * │  Do not "fix" the omission. See docs/adr/006-plugin-authoring-        │
 * │  toolkit.md and the header of src/plugins/example/index.ts.           │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import type { MaquettePlugin } from '@/kernel';
import { plugin as blocksBasic } from '@/plugins/blocks-basic';

export const PLUGIN_LIST: ReadonlyArray<MaquettePlugin> = [
  // ── Lot 1 · built-ins (SPEC.md §7) ──────────────────────────────────────
  blocksBasic,
  // toolsBasic,
  // flatplan,
  // spreadEditor,
  // inspector,
  // ── Lot 2+ · probes (SPEC.md §8), each behind its own flag ──────────────
];

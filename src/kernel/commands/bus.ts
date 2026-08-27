/**
 * The command bus — SPEC.md §4.3. THE ONLY DOOR TO MUTATION.
 *
 *   validate → reduce (pure) → log → notify
 *
 * Direct writes to the document store are bugs (CLAUDE.md §4). Continuous
 * gestures commit ONE command on gesture end.
 */
import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import type { Block, DocumentV1, PageSetup, Spread } from '../model/types';
import { KernelError, reduce } from '../model/reducers';
import { blockSchema, pageSetupSchema } from '../model/schema';
import { createSeedDocument, newId } from '../model/seed';
import { CommandLog, type LogEntry } from './log';
import { History } from './history';

export type Command =
  | { type: 'block/add'; spreadId: string; block: Block }
  | { type: 'block/update'; spreadId: string; blockId: string; patch: Partial<Block> }
  | { type: 'block/remove'; spreadId: string; blockId: string }
  | { type: 'spread/add' }
  | { type: 'spread/update'; spreadId: string; patch: Partial<Omit<Spread, 'id' | 'blocks'>> }
  | { type: 'doc/update'; patch: Partial<Omit<DocumentV1, 'schemaVersion' | 'id' | 'spreads'>> };

/* ── validation ───────────────────────────────────────────────────────────── */

const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('block/add'), spreadId: z.string().min(1), block: blockSchema }),
  z.object({
    type: z.literal('block/update'),
    spreadId: z.string().min(1),
    blockId: z.string().min(1),
    patch: z.looseObject({}),
  }),
  z.object({
    type: z.literal('block/remove'),
    spreadId: z.string().min(1),
    blockId: z.string().min(1),
  }),
  z.object({ type: z.literal('spread/add') }),
  z.object({
    type: z.literal('spread/update'),
    spreadId: z.string().min(1),
    patch: z.object({ cols: z.number().finite().optional() }),
  }),
  z.object({
    type: z.literal('doc/update'),
    patch: z.object({
      title: z.string().optional(),
      updatedAt: z.number().finite().optional(),
      page: pageSetupSchema.partial().optional(),
    }),
  }),
]);

export function validateCommand(cmd: Command): void {
  const r = commandSchema.safeParse(cmd);
  if (!r.success) {
    throw new KernelError(`invalid command ${String(cmd.type)}: ${z.prettifyError(r.error)}`);
  }
}

/* ── state ────────────────────────────────────────────────────────────────── */

export const KERNEL_SOURCE = 'kernel';

interface DocState {
  doc: DocumentV1;
}

const docStore = createStore<DocState>(() => ({ doc: createSeedDocument() }));
const commandLog = new CommandLog();
const history = new History<DocumentV1>();

/** Transaction frame: several commands, one undo step, one log group. */
let tx: { before: DocumentV1; label: string; groupId: string; depth: number } | null = null;

const reduceCtx = { nextId: () => newId('spread') };

export function getDocument(): DocumentV1 {
  return docStore.getState().doc;
}

export function subscribeDoc(cb: (doc: DocumentV1) => void): () => void {
  return docStore.subscribe((state, prev) => {
    if (state.doc !== prev.doc) cb(state.doc);
  });
}

export function getLog(): ReadonlyArray<LogEntry> {
  return commandLog.list();
}

export function subscribeLog(cb: (entries: ReadonlyArray<LogEntry>) => void): () => void {
  return commandLog.subscribe(cb);
}

export function subscribeHistory(cb: () => void): () => void {
  return history.subscribe(cb);
}

export function canUndo(): boolean {
  return history.canUndo();
}
export function canRedo(): boolean {
  return history.canRedo();
}

/* ── dispatch ─────────────────────────────────────────────────────────────── */

/** SPEC.md §4.3 verbatim entry point. Stamps `source: 'kernel'`. */
export function dispatch(cmd: Command): void {
  dispatchAs(KERNEL_SOURCE, cmd);
}

/**
 * The real door. `PluginContext.bus.dispatch` binds `source` to the plugin id
 * (SPEC.md §4.5) so the log always names who asked.
 */
export function dispatchAs(source: string, cmd: Command): void {
  validateCommand(cmd);

  const prev = getDocument();
  const next = reduce(prev, cmd, reduceCtx);

  commandLog.append({
    ts: Date.now(),
    cmd,
    source,
    ...(tx ? { groupId: tx.groupId, label: tx.label } : {}),
  });

  if (next === prev) return; // no-op command: logged as intent, no history step

  if (!tx) history.push(prev, labelFor(cmd));
  docStore.setState({ doc: { ...next, updatedAt: Date.now() } });
}

/**
 * Group several commands into ONE undo step and one log group.
 * Used by `applyChangeSet` (§4.9) and by plugins whose single gesture produces
 * several commands (P3 sketch, P4 ad-hoc tools).
 */
export function transactAs<T>(source: string, label: string, fn: () => T): T {
  if (tx) {
    tx.depth += 1;
    try {
      return fn();
    } finally {
      tx.depth -= 1;
    }
  }

  const before = getDocument();
  tx = { before, label, groupId: `${source}:${newId('grp')}`, depth: 1 };
  try {
    const result = fn();
    if (getDocument() !== before) history.push(before, label);
    return result;
  } catch (err) {
    // Roll the whole group back: a half-applied gesture is worse than none.
    if (getDocument() !== before) docStore.setState({ doc: before });
    throw err;
  } finally {
    tx = null;
  }
}

export function transact<T>(label: string, fn: () => T): T {
  return transactAs(KERNEL_SOURCE, label, fn);
}

function labelFor(cmd: Command): string {
  switch (cmd.type) {
    case 'block/add':
      return 'Add block';
    case 'block/update':
      return 'Change block';
    case 'block/remove':
      return 'Delete block';
    case 'spread/add':
      return 'Add spread';
    case 'spread/update':
      return 'Change spread';
    case 'doc/update':
      return 'Change document';
  }
}

/* ── history ──────────────────────────────────────────────────────────────── */

export function undo(): void {
  const step = history.undo(getDocument());
  if (!step) return;
  docStore.setState({ doc: { ...step.doc, updatedAt: Date.now() } });
}

export function redo(): void {
  const step = history.redo(getDocument());
  if (!step) return;
  docStore.setState({ doc: { ...step.doc, updatedAt: Date.now() } });
}

/* ── document lifecycle (boot, import, reset) ─────────────────────────────── */

/**
 * Replace the whole document. NOT a command: loading a file or importing JSON
 * is not an edit, and it clears history rather than becoming undoable.
 */
export function replaceDocument(doc: DocumentV1, opts: { resetHistory?: boolean } = {}): void {
  if (opts.resetHistory !== false) {
    history.clear();
    commandLog.clear();
  }
  docStore.setState({ doc });
}

/** Test seam: restore a pristine kernel between test cases. */
export function __resetBusForTests(doc?: DocumentV1): void {
  tx = null;
  history.clear();
  commandLog.clear();
  docStore.setState({ doc: doc ?? createSeedDocument() });
}

export type { LogEntry, PageSetup };

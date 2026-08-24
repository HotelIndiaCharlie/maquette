# ADR-002 — The command bus is the only door to mutation

- Status: accepted (Lot 0)

## Context

Interaction research needs an honest record of what the designer did. If some
mutations go through a bus and others write a store directly, the log is
fiction — and P9 (`constraint-mining`) mines that log for repeated intent.

## Decision

`validate → reduce (pure) → log → notify`, and nothing else writes the document.

- **Validate.** Every command is parsed by a zod discriminated union before a
  reducer sees it. An invalid command throws `KernelError`; it is a programming
  error, not a user error.
- **Reduce.** `reduce(doc, cmd, ctx)` is pure. Ids and the clock arrive through
  `ReduceContext`, so reducers are table-testable. Reducers enforce the two
  document invariants — the 14 × 8 mm minimum and containment in the spread —
  in `normalizeFrame`, so no caller can persist an illegal frame.
- **No-ops keep their identity.** A patch on a block that no longer exists
  returns the *same* document reference. It is logged (the intent happened) but
  takes no history step, so undo never has an inert rung.
- **Log.** Each entry carries `{ ts, cmd, source }`, where `source` is the
  plugin id, stamped by `PluginContext.bus.dispatch`.
- **One command per completed gesture.** A drag previews locally and commits
  once on pointer-up. Log-length assertions in each plugin's tests enforce it.

## Amendments to §4.3, and why

1. **`transact(label, fn)`** — several commands, one undo step, one log group.
   Required by `applyChangeSet` (§4.9, a ChangeSet must undo as a unit), by P3
   (`sketch`: "undo removes all three as one gesture") and by P4 (`adhoc-tools`:
   "each invocation = one log entry group"). A failed transaction rolls the whole
   group back — a half-applied gesture is worse than none.
2. **`LogEntry` carries optional `groupId` and `label`** alongside the §4.3
   fields. A superset, so the §4.3 signature stays satisfied.
3. **`getDocument()`** in the plugin bus API. §4.3 lists only `subscribeDoc`;
   every view needs to read the current document to render its first frame.
4. **`replaceDocument(doc)`** — loading a file or importing JSON is not an edit.
   It is not a command, and it clears history and log rather than becoming
   undoable.

## Consequences

History is snapshot-based: immer's structural sharing makes holding whole
document references per step cheap, and makes undo exact. Depth is capped at
200 steps, the log at 5000 entries.

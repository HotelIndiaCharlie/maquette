# ADR-004 — The job seam, and the mock behind it

- Status: accepted (Lot 0)

## Context

Three probes (P6 `marks-execute`, P7 `jobs-run`, P8 `diff-review`) test whether
professionals will delegate work to something asynchronous. None of the five
built-ins uses the seam. It is in the kernel under criterion (c): it must be
swappable for a real executor (SPEC.md §9) without any plugin changing.

## Decision

`JobExecutor.run(req) → JobHandle`, and results come back as `ChangeSet`s.

- **Nothing auto-applies.** A `ChangeSet` reaches the document only through
  `applyChangeSet(cs, { acceptGroupIds })`, which dispatches every command
  through the bus inside one `transact` — so it is undoable as a unit, logged,
  and attributed to whoever applied it.
- **Accept and reject are per intent group**, never per micro-command. Group
  granularity is the executor's editorial responsibility.
- **Scope is a displayed guarantee.** `scope.lockedBlockIds` is not advice: the
  executor must never emit a command touching one. `changeSetTouches(cs, ids)`
  exists so this is assertable, and it is asserted.

### MockExecutor

Kernel-provided and deterministic, so the async delegation UX is testable by a
human with no agent anywhere near the machine, and by CI with fake timers:

- seeded (mulberry32) artificial latency, 2–8 s
- ten progress ticks
- exactly one partial ChangeSet at the halfway mark
- `cancel()` clears its timers synchronously — well inside the 100 ms budget —
  rejects `result` with `JobCancelledError`, and emits nothing further
- two demo kinds: `nudge-baselines` (snap unlocked frames to the baseline grid,
  one group per spread) and `echo` (a mark's note comes back as two plausible
  canned edits)

## Consequences

`JobCancelledError` is a rejection, not a resolution: a cancelled job has no
result, and callers must not treat "no change" as success. The mock attaches a
no-op `.catch` internally so a cancelled job never surfaces as an unhandled
rejection in a consumer that attaches its handler late.

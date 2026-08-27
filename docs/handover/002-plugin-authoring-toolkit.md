# Handover 002 — Plugin authoring toolkit, then B1

Start a fresh branch off `dev` (currently `5d162dc`). Lot 0 is merged and green.

**Read first, in this order:** `CLAUDE.md` (12 hard rules) → `SPEC.md` §2, §4.5, §5,
§6.1–6.4, §7 → `docs/adr/001`–`005` → `docs/handover/001-lot0-complete.md`.
Everything below assumes you have.

---

## 1. Mission

Lot 1 is five built-in plugins (SPEC.md §7), then seven-plus probes (§8). Each is
written by a separate LLM session working from a §5 work packet. Today's job is to
build **the toolkit those sessions use**, and then prove it by writing B1 through it.

The toolkit has three jobs:

1. Stop a plugin-authoring session from **hallucinating kernel APIs**. This is the
   single highest-value thing here. The kernel's real surface differs from the PRD in
   documented ways (§4 below); a session working from `SPEC.md` alone will both miss
   what exists and invent what doesn't.
2. Turn a **human's rough plugin idea into a filled §5 work packet** through
   structured interrogation, so the implementing session never has to infer.
3. Make the §5 acceptance rules **executable** rather than aspirational.

**Deliberate scope limit:** the toolkit is not a feature. It is allowed to touch
`docs/`, `scripts/`, `test/`, `.claude/`, and `package.json`. CLAUDE.md rule 3
("adding a feature modifies ZERO files outside its folder") governs *plugins*, not
tooling — do not contort the toolkit to satisfy a rule that isn't about it. B1, built
in phase 2, **is** a feature and must obey rule 3 exactly.

---

## 2. Four decisions already made — implement these, don't relitigate

| # | Decision | Rationale |
|---|---|---|
| D1 | The authoring protocol is **one doc + a thin skill pointer**. `docs/plugin-authoring.md` is the single source of truth; `.claude/skills/plugin-packet/SKILL.md` is a short frontmatter + pointer to it. | Auto-triggers in Claude Code; the same file stays paste-able into any other LLM. One file to maintain. |
| D2 | Scope is **toolkit at v0.1 → build B1 through it → amend from what hurt → stamp v1.0**. | A template never exercised by a real plugin encodes guesses. §6.1 still permits kernel amendment (via ADR) during Lot 1, so B1 is also the last cheap chance to find a missing kernel API. |
| D3 | Doc versioning is **pinned to a hash of the kernel's export list**, enforced by a test. | Hand-maintained version headers rot silently. This mirrors how `test/boundaries.test.ts` already guards the boundary rules — the existing, proven pattern in this repo. |
| D4 | A **permanent example plugin** lives in `src/plugins/`, compiled and boundary-linted forever, never in the load list. | It is the one artifact an LLM can copy that is *guaranteed* to compile against the real kernel. The Lot 0 demo plugin proved the pattern but was deleted; this makes it permanent. |

**D4 constraint — read carefully.** `PLUGIN_ID_PATTERN` in
`src/kernel/plugins/boundaries.ts` is `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the contract
is `folder name === id`. So the example folder **cannot** be `_example` or
`__template__`. Name it `src/plugins/example/` with id `example`. Keep it out of
`PLUGIN_LIST` in `src/shell/plugins.ts`, and say so in a header comment in both files
so nobody "fixes" the omission later.

---

## 3. Deliverables

### Phase 1 — the toolkit (v0.1)

**A. `docs/plugin-api.md` — the plugin-facing kernel API reference.**
The contract surface as a plugin author sees it, derived from the real
`src/kernel/index.ts`, not from SPEC.md. Organise by what a plugin actually does:
register things · read the document · mutate through the bus · selection & viewport ·
pointer & geometry · text seam · storage sidecars · jobs & ChangeSets · flags.

For each entry: signature, one line on when to use it, and one on the rule it
enforces. Mark the documented deviations from the PRD explicitly (§4 below) — a
reader who knows SPEC.md needs to see where reality differs and why.

Include, prominently: **what a plugin may import** (`@/kernel`, `@/components/ui`,
`@/styles`, own folder — nothing else), and **what is forbidden** (cross-plugin,
shell, kernel internals via `@/kernel/*/*`, direct `idb-keyval`/`localStorage`/
`indexedDB`). Quote the ESLint messages; they cite rule numbers and are good teaching.

Frontmatter carries `kernel-api-version` and `kernel-api-hash`.

**B. `test/plugin-api-version.test.ts` — the anti-rot mechanism (D3).**
Extract the sorted list of exported identifiers from `src/kernel/index.ts` (parse
export statements — do **not** hash raw file content, or a comment edit breaks the
build), hash it, compare to `kernel-api-hash` in `docs/plugin-api.md`. On mismatch,
fail with a message naming which identifiers were added or removed and instructing
the author to update the doc and bump `kernel-api-version`. Follow the shape of
`test/boundaries.test.ts`.

**C. `docs/templates/plugin-packet.md` — the blank §5 work packet.**
Exactly the eight parts, no more: Manifest · Consumes · Registers · Behavior ·
Keyspace · Acceptance · Human test script · Do-not-touch. Each section carries a
one-line instruction on what "complete" means. Encode §6.2's hard rules in the
template itself: **every behavior number stated explicitly** (no "reasonable
defaults"), and **if a needed kernel API does not exist, write "BLOCKED: requires
kernel amendment" and stop** — never invent one. Pre-fill Do-not-touch with the
constant part: `src/kernel`, `src/shell` (except the one load-list line), every other
plugin folder.

**D. `docs/plugin-authoring.md` — the interview protocol (D1).**
Three phases, written as instructions to an LLM:

1. *Interrogate.* Take a rough idea and grill the human until every §5 blank can be
   filled without inference. Push hardest where §5 is weakest in practice: exact
   numbers, the sidecar keyspace, what the human test script actually looks like as
   numbered steps, and which existing plugin data is read (probes P6/P8 read other
   plugins' sidecars, and there is **no import allowed** — the read contract must be
   spelled out). Do not stop at the first plausible answer; resolve each branch.
2. *Emit.* Produce the filled packet from `docs/templates/plugin-packet.md`.
3. *Implement & verify.* Scaffold, build, run the gate, run the acceptance scripts.

State the standing constraints once, clearly: all mutations via `ctx.bus.dispatch`;
one command per completed gesture (use `ctx.bus.transact` when a gesture needs
several); plugin data in `ctx.storage(ns)` sidecars, never inside `DocumentV1`;
tokens only, no arbitrary style values, two-ink rule; geometry is inline style from
the model, never a class.

**E. `.claude/skills/plugin-packet/SKILL.md`** — frontmatter (`name`, `description`
that triggers on plugin ideas / work packets / new Maquette plugin) plus a short
pointer to D. Keep the substance in D so the file stays portable.

**F. `src/plugins/example/` — the permanent reference plugin (D4).**
Mirrors what the deleted Lot 0 demo proved: registers in all five registries, dispatches
one command through the bus, reads and writes one sidecar key, renders on paper.
Heavily commented — each comment says *which rule* the line satisfies. It must
typecheck, lint clean under the plugin boundary rules, and stay out of the load list.
Add one unit test asserting the manifest is valid and `register()` returns a working
disposer.

**G. `pnpm new:plugin <id>` (`scripts/new-plugin.mjs`).**
Copies `src/plugins/example/` to `src/plugins/<id>/`, renames the id throughout,
strips the teaching comments, drops in a packet stub from C. Validates `<id>` against
`PLUGIN_ID_PATTERN` and refuses if the folder exists. **Deliberately does not touch
`src/shell/plugins.ts`** — adding that one line stays a conscious human act, and it
keeps the "one line" discipline visible.

**H. `pnpm verify:plugin <id>` (`scripts/verify-plugin.mjs`) — §5 part 6, executable.**
Two checks the handover says are "worth repeating per built-in":
- *Independence:* `git diff --name-only` against the branch point shows nothing
  outside `src/plugins/<id>/` except the single line in `src/shell/plugins.ts`.
- *Removal:* remove the folder and its load-list line in a scratch copy, run
  `pnpm typecheck`, confirm the app still compiles, restore.

**I. Fix `pnpm lint:boundaries`.** It currently points at `scripts/boundaries.mjs`,
which does not exist — the script fails outright. CI does not call it (it relies on
`pnpm lint` plus `test/boundaries.test.ts`, both green), but CLAUDE.md rule 11 names
boundary-lint as a gate. Either implement it as a real thin wrapper or delete the
script entry. Do not leave a named gate broken.

**J. `docs/adr/006-plugin-authoring-toolkit.md`.** Short. Records the example-plugin
convention (in `src/plugins/`, never in the load list, and why), the API-hash
versioning mechanism, and the toolkit's exemption from rule 3. No kernel change is
involved, so this ADR documents convention, not architecture.

### Phase 2 — validate on B1, then stamp v1.0

Build **B1 `blocks-basic`** (SPEC.md §7) using only the toolkit: run the interview
protocol against §7's B1 description, emit the packet, scaffold with
`pnpm new:plugin blocks-basic`, implement, verify.

B1 registers four block types — body, headline, quote, image — each with MiniView
(greeked, Layer 1), FullView (typographic, Layer 2), and an Inspector fragment.
Defaults are binding: body 9.5/12pt, headline 38/40pt (`"The shape of the page"`),
quote 16/20pt, image has no text attrs. Sliders 6–72pt size / 7–80pt leading, step
0.5. Keyspace: none.

Then **amend the toolkit from what actually hurt** — every blank the template failed
to elicit, every kernel API the doc failed to surface, every question the protocol
should have asked. Stamp `plugin-packet` v1.0 and record the amendments in the ADR.

Do **not** proceed to B2. The next session takes tools-basic.

---

## 4. Kernel reality vs SPEC.md — the deviations `docs/plugin-api.md` must carry

All four are **documented and deliberate**, in-place in the ADRs. They are not drift.
They are also the things an LLM working from the PRD alone will get wrong.

1. **Canvas primitives are kernel, not shell** (ADR-001). `SpreadPaper`, `BlockLayer`,
   `OverlayLayer` live in `src/kernel/canvas/` even though SPEC.md §4.7 puts the
   canvas host in the shell — B3 and B4 both need identical paper, and a plugin cannot
   import the shell.
2. **The command bus is wider than §4.3** (ADR-002): `transact(label, fn)` (several
   commands, one undo step, one log group — this is how "one command per gesture"
   is satisfied by multi-step gestures), `getDocument()` on the plugin bus, and
   `replaceDocument(doc)` for import (loading a file is not an edit).
3. **`ctx.registry` is readable, not write-only** (ADR-003) — B5's inspector must find
   B1's `Inspector` fragment without importing B1.
4. **`activeTool` + `forwardPointer()` are kernel** (ADR-003) — the shell's tool rail
   and plugin-rendered canvases must agree on the active tool without importing each
   other.

There is also a React hooks surface exported for plugins (`useDocument`, `useSpread`,
`useSelection`, `useViewport`, `useRegistry`, `useActiveTool`, `useCommandLog`,
`useHistoryState`) that SPEC.md never mentions. Document it.

---

## 5. Two fixed bugs — do not reintroduce

- `idb-keyval`'s `createStore()` provisions **one object store per database**.
  Documents and sidecars use separate DB names (`maquette-documents`,
  `maquette-sidecar`), not one shared DB with two stores.
- `measure()` rounds `usedHeightMm` **once** and derives `fill` from the rounded
  value, not the raw float — otherwise a UI showing both quotes two different numbers.

---

## 6. Acceptance

Full local gate, matching CI's two jobs:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
```

Plus, specific to this handover:

- `pnpm new:plugin scratch-test` produces a folder that typechecks and lints clean
  with zero edits; delete it afterwards.
- `pnpm verify:plugin blocks-basic` passes both the independence and removal checks.
- `test/plugin-api-version.test.ts` fails when an export is added to
  `src/kernel/index.ts` without the doc being updated — prove it by trying it.
- `pnpm lint:boundaries` either works or is gone.
- Boot with `PLUGIN_LIST` containing only `blocksBasic`: four block types render in
  both layers, zero console errors.
- `git diff` for B1 shows nothing outside `src/plugins/blocks-basic/` except one line
  in `src/shell/plugins.ts`.

**Do-not-touch:** `src/kernel/**` and `src/shell/**` beyond the single load-list line.
If B1 genuinely needs a kernel API that does not exist, §6.1 permits an amendment
during Lot 1 — but only with a demonstrated need and a new ADR. Absent that, STOP and
report BLOCKED (CLAUDE.md rule 12). Never invent a kernel change.

**Do not open a PR** unless asked — the human creates them from the Claude Code UI.

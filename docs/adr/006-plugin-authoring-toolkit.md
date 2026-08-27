# ADR-006 — The plugin authoring toolkit

- Status: accepted (Lot 1, before B1)
- Scope: convention and tooling. **No kernel change is involved.**

## Context

Lot 1 is five built-in plugins; Lot 2+ is nine research probes. Each is written by a
separate LLM session working from a SPEC.md §5 work packet. Three things go wrong when
that session starts cold:

1. **It hallucinates kernel APIs.** The kernel's real surface differs from SPEC.md in
   five documented ways (ADR-001, ADR-002, ADR-003). A session working from the PRD alone
   both misses what exists — `transact`, the canvas primitives, the hooks — and invents
   what doesn't.
2. **It infers the numbers nobody stated.** SPEC.md §6.2 requires every behaviour number
   to be explicit. In practice a §7 paragraph leaves a dozen blanks, and a session that
   fills them with its own judgement produces a plugin nobody asked for.
3. **The §5 acceptance rules are aspirational.** "Zero files modified outside the folder"
   and "removal leaves the app compiling" were checked by eye in Lot 0.

## Decision

Four pieces, and one exemption.

### 1. One protocol document, one thin skill pointer

`docs/plugin-authoring.md` is the single source of truth for how a plugin gets written:
Interrogate → Emit → Implement. `.claude/skills/plugin-packet/SKILL.md` is frontmatter
plus a pointer to it.

The substance stays in `docs/` so the same file is paste-able into any model, and there
is one file to maintain rather than two that drift. The skill exists only so the protocol
auto-triggers in Claude Code when someone describes a plugin idea.

### 2. `docs/plugin-api.md`, pinned to a hash of the kernel's export list

The doc is organised by what a plugin *does* — register, read, mutate, select, point,
measure, persist, delegate — not by kernel module layout, and it opens with the five
deviations from SPEC.md.

Hand-maintained version headers rot silently, so `test/plugin-api-version.test.ts`
extracts the sorted list of exported identifiers from `src/kernel/index.ts`, hashes it,
and compares against `kernel-api-hash` in the doc's frontmatter. On mismatch it fails with
the current hash, the current count, the full sorted export list, and instructions.

**It parses export statements; it does not hash file content.** Hashing the file would
mean a comment edit breaks the build, which trains authors to bump the hash without
reading the doc — the exact rot the mechanism exists to prevent. The entry for each
identifier carries its kind (`value:` / `type:`), so demoting a value export to a
type-only export still moves the hash.

This mirrors `test/boundaries.test.ts`: the rule is the test, and loosening the rule fails
CI. Same pattern, already proven in this repo.

### 3. A permanent example plugin, never in the load list

`src/plugins/example/` registers in all five registries, dispatches one command through
the bus, reads and writes one sidecar key, and renders on paper. Every comment names the
rule the line satisfies.

It is compiled and boundary-linted on every CI run, which makes it **the one artefact an
author can copy that is guaranteed to compile against the real kernel.** The Lot 0 demo
plugin proved the pattern and was deleted; this makes it permanent.

- **Its id is `example`, not `_example` or `__template__`.** `PLUGIN_ID_PATTERN` is
  `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` and the contract is folder name === id (SPEC.md §4.5
  rule 1), so both underscore forms are invalid ids.
- **It is deliberately absent from `PLUGIN_LIST`.** A teaching artefact must not load. A
  header comment in `src/plugins/example/index.ts` and a matching box in
  `src/shell/plugins.ts` say so, so nobody "fixes" the omission later.
- `src/plugins/example/example.test.ts` holds it to the contract: valid manifest,
  registrations in all five registries that all disappear on unload, one command per
  completed gesture, and a sidecar round-trip proving the `${pluginId}:${namespace}:`
  prefix.

### 4. The §5 acceptance rules, executable

| Command | Enforces |
|---|---|
| `pnpm new:plugin <id>` | Scaffolds from `example/`, renames throughout, strips the teaching comments, drops a packet stub from `docs/templates/plugin-packet.md`. Validates the id against `PLUGIN_ID_PATTERN`; refuses an existing folder. **Deliberately does not touch `src/shell/plugins.ts`** — adding that line stays a conscious act, because it is the line rule 5 is about. |
| `pnpm verify:plugin <id>` | *Independence* (§4.5 rule 5): committed **and** uncommitted changes since the branch point, nothing outside the folder except one line in the load list. *Removal* (§4.5 rule 4): folder and load-list line deleted **in a scratch copy** — the working tree is never mutated — then `tsc -b` must still pass. |
| `pnpm lint:boundaries` | Was pointing at a missing `scripts/boundaries.mjs`, so a gate CLAUDE.md §11 names failed outright. Now a thin wrapper that runs the real `eslint.config.js` over `src/kernel`, `src/plugins` and `src/shell` and reports only `no-restricted-imports` / `no-restricted-globals`. Deliberately **not** a second rule engine: one source of truth for the boundary policy. |

### 5. The toolkit's exemption from CLAUDE.md rule 3

Rule 3 — "adding a feature modifies ZERO files outside its folder" — governs **plugins**.
The toolkit is not a feature. It touches `docs/`, `scripts/`, `test/`, `.claude/`,
`package.json`, and `src/plugins/example/`, and that is correct rather than a violation to
be engineered around.

One deliberate exception is worth naming: the toolkit adds a **comment-only** block to
`src/shell/plugins.ts`, recording why `example` is absent from `PLUGIN_LIST`. No
behaviour changes. It is there because the omission is exactly the kind of thing a later
session "corrects", and the comment is the cheapest guard against that.

B1 and every plugin after it **are** features and obey rule 3 exactly.

## Consequences

- A kernel export added without updating `docs/plugin-api.md` fails CI with a message
  naming the hash to set and the doc to update. Editing the hash without the prose is
  possible and is the one failure mode this cannot mechanically prevent — the ADR names
  it so a reviewer can.
- `src/plugins/example/` must keep compiling forever. If a kernel amendment breaks it,
  that is signal, not noise: it means the amendment broke every plugin.
- The template is stamped **v0.1** until a real plugin has been built through it. B1 is
  that plugin; the session that implements it amends the template and the protocol from
  what actually hurt, and stamps v1.0.

## Amendments from the first live run (B1 interview, template v0.2 / protocol v0.2)

`docs/packets/blocks-basic.md` was produced by running this protocol against SPEC.md §7
B1. The interview — not the template — surfaced three things the template had no slot
for. They are now in it:

1. **Load-order testability.** With `PLUGIN_LIST = [blocksBasic]` there is no tool, no
   flatplan and no spread editor, so the shell falls through to the placeholder and
   nothing renders: §7's B1 human test was unperformable as written. Built-ins are
   implemented in order, so every early one has this problem. The template's *Registers*
   section now asks it outright, and B1 answers it by registering one synthetic,
   read-only playground view (SPEC.md §1 blesses the playground as product surface).
2. **Self-conflicts in SPEC.md.** §7 B1 puts *bold sans* and a *micro-caption* on paper;
   §3 keeps UI type off paper and `tokens.css` says the micro-type tokens are "never used
   on paper". Both are real, both resolvable, both would otherwise be resolved silently
   and differently by each implementer. Behaviour §4.6 of the template now records them.
3. **Packet shape.** The first draft of B1's packet grew a ninth part for those conflicts.
   SPEC.md §5 says *exactly* eight. Folded back into part 4, and the protocol now says so.

The protocol also gained three interview mechanics that made the difference in practice:
put the API constraint in the question rather than the options, compute the numbers before
offering them, and mark decisions you made yourself as `[CALL]` so they can be reversed
without re-derivation.

Still **v0.2, not v1.0**: no line of B1 has been implemented yet. The session that builds
it stamps v1.0 from what hurts during implementation.

## Amendments from implementing B1 (packet template v1.0, protocol v1.0)

B1 `blocks-basic` is the toolkit's first real plugin, built strictly from
`docs/packets/blocks-basic.md` and `docs/plugin-api.md` with no other context. Nothing in
the packet turned out to be wrong, unbuildable, or ambiguous — every number in it was used
exactly as stated, and the four block types, the playground view and every unit test came
together without needing to invent a value. What hurt was entirely at the toolkit's edges:
the verification script, the test environment, and two small gaps in what the packet
template and protocol prompt for. Four items, each hit for real during this build, not
predicted in advance:

1. **`pnpm verify:plugin <id> --base 97e18e2` — the exact command handover 003 told this
   session to run — failed on a clean checkout, for a reason outside this plugin's code.**
   The independence check's allowlist covered `docs/packets/<id>.md` but not
   `docs/handover/*.md`. Handover 003 itself (`docs/handover/003-b1-blocks-basic.md`) was
   committed to `dev` *before* this session started, so it was always going to show up as
   a rule-5 stray under that exact base — the first invocation of the canonical command
   failed through no fault of the plugin. **Fixed:** `scripts/verify-plugin.mjs` now
   allow-lists any `docs/handover/*.md` file whose name contains the plugin id, alongside
   the existing packet allowance. This does not make a hardcoded `--base <sha>` durable,
   though — the fix commit itself, and every later toolkit-stamp commit on the same
   branch, will keep tripping that same SHA for the next session that copies it verbatim.
   The actual fix is procedural: `docs/plugin-authoring.md` Phase 3 step 5 now says to pass
   `--base` pointing at *your own* session's starting commit, not a SHA quoted in a
   handover. (Verified both ways: `--base 410c28a`, this session's real branch point,
   passes clean; `--base 97e18e2` reproduces the original failure until the script fix is
   in the diff too, then fails again on the script fix itself — expected, since that fix is
   a genuine toolkit-scope file outside the plugin folder, and rule 5 was never about the
   toolkit. See `docs/plugin-authoring.md`'s amended step 5 for the honest read of both
   runs.)

2. **No plugin can unit-test a rendered Radix control — jsdom has neither `ResizeObserver`
   nor pointer capture.** B1's packet (§4.6) requires proving the Inspector's slider commits
   exactly once per gesture with a log-length assertion, the same way the example plugin's
   tool does — but the example plugin's own gesture is a pair of plain functions
   (`onDown`/`onUp`), never a rendered component, so it demonstrates nothing about testing
   one. The first attempt to render `@/components/ui/slider` in a vitest test threw
   `ResizeObserver is not defined` at mount; after stubbing that, the first simulated
   `pointerdown` threw `target.hasPointerCapture is not a function`. Neither is a Maquette
   bug — both are jsdom gaps everyone building an interactive Inspector, overlay, or panel
   will hit identically. **Fixed:** both stubbed once in `test/setup.ts`, guarded for the
   `// @vitest-environment node` kernel tests that have no DOM at all. A `getBoundingClientRect`
   stub and `IS_REACT_ACT_ENVIRONMENT = true` are still a per-test concern (they depend on
   the actual gesture geometry) and are called out in `docs/plugin-authoring.md`'s "Things
   that will bite" instead.

3. **The packet template's playground guidance doesn't mention `Spread.cols`.** Part 3's
   "Can this plugin be seen at all with only itself loaded?" callout tells an author to
   build a synthetic `Spread` for a playground view, but a `Spread` is
   `{ id, cols, blocks }` — the callout never named `cols`, so nothing prompted listing
   `DEFAULT_COLS` in *Consumes* even though `docs/plugin-api.md` §3 already documents it
   correctly. B1's packet Consumes table (§2) reached this exact gap: no overlay or column
   tool is loaded in the playground, so nothing in the view *displays* `cols`, but the
   `Spread` object cannot be constructed without a value for it. **Fixed:** the callout in
   `docs/templates/plugin-packet.md` part 3 now names `DEFAULT_COLS` directly.

4. **A packet's "commit equal to current value dispatches nothing" rule (§4.6) cannot be
   demonstrated by driving the real widget.** Radix's `Slider` already checks
   `hasChanged` before calling `onValueCommit`, so a drag that starts and ends at the same
   value never reaches the handler at all — there is nothing to observe through the UI.
   B1's `TypeInspector.tsx` keeps the guard anyway (defense-in-depth, per the packet), but
   as a small exported pure function (`resolveCommit`) tested directly with two numbers in
   and one nullable number out, rather than through a simulated gesture. Noted in
   `docs/plugin-authoring.md`'s "Things that will bite" so the next session doesn't spend
   time trying to reproduce a no-op commit through the widget before finding this out the
   same way.

`src/plugins/example/` itself needed no change: nothing in it taught B1 something wrong.
Its one interactive gesture (a tool, not a component) and its one sidecar round-trip both
held up exactly as documented; the gaps above are all in the surrounding toolkit, not in
the reference plugin.

**Toolkit stamped v1.0** — `docs/templates/plugin-packet.md` (`packet-template-version:
1.0`), `docs/plugin-authoring.md` (`protocol-version: 1.0`). `docs/plugin-api.md` needed no
change: B1 touched zero kernel exports, so its `kernel-api-hash` and prose stand as they
were at v0.2.

## Alternatives rejected

- **A generator that also edits `src/shell/plugins.ts`.** Rejected: it hides the one line
  the entire independence rule is about.
- **Hashing `src/kernel/index.ts` verbatim.** Rejected: comment edits would break the
  build and train people to bump the hash blindly.
- **`_example` / `__template__` as the folder name.** Rejected: invalid under
  `PLUGIN_ID_PATTERN`, and folder name === id.
- **A second boundary-rule implementation in `scripts/boundaries.mjs`.** Rejected: two
  sources of truth for the policy that everything else rests on.

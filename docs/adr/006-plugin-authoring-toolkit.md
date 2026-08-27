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

## Alternatives rejected

- **A generator that also edits `src/shell/plugins.ts`.** Rejected: it hides the one line
  the entire independence rule is about.
- **Hashing `src/kernel/index.ts` verbatim.** Rejected: comment edits would break the
  build and train people to bump the hash blindly.
- **`_example` / `__template__` as the folder name.** Rejected: invalid under
  `PLUGIN_ID_PATTERN`, and folder name === id.
- **A second boundary-rule implementation in `scripts/boundaries.mjs`.** Rejected: two
  sources of truth for the policy that everything else rests on.

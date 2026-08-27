# Handover 001 — Lot 0 complete, Lot 1 next

Repo: `HotelIndiaCharlie/maquette` · Merged: PR #2 → `dev` at `5d162dc` ·
Branch used: `claude/maquette-prd-v3-kernel-lj3y7v` (now merged; start a fresh branch
off `dev` for Lot 1)

## What exists now

Read `SPEC.md` (the PRD, v3) and `CLAUDE.md` (the 12 hard rules) before touching
anything — both are at repo root. Then `docs/adr/001-005` for the reasoning behind
every kernel decision.

Lot 0 shipped the kernel + shell with zero plugins. The litmus test (SPEC.md §2)
holds: boot to an empty document, empty desk, placeholder view, clean build. 151 unit
tests, 5 e2e tests, typecheck/lint/build all green.

```
src/kernel/     FROZEN except by ADR until Lot 1 finishes. model, commands (bus),
                geometry, text seam, selection, viewport, pointer, storage,
                jobs (MockExecutor), registry (5 registries + activeTool),
                plugins (contract/loader/boundaries), canvas (paper primitives)
src/shell/      TopBar, ToolRail, PanelDock, CanvasHost, routes, flags,
                plugins.ts ← THE LOAD LIST (currently empty — add Lot 1 here)
src/plugins/    empty — every feature goes here, one folder per plugin id
src/components/ui/  shadcn, vendored, tokens/variants only
```

## Three decisions worth knowing before you write a plugin

1. **Canvas host split (ADR-001):** SPEC.md §4.7 puts canvas host in shell, but
   `SpreadPaper`/`BlockLayer`/`OverlayLayer` live in `kernel/canvas` instead — B3 and
   B4 both need identical paper and a plugin can't import the shell. This is a
   deliberate, documented deviation.
2. **Kernel API additions beyond §4.3/§4.5 (ADR-002/003):** `transact()` (one gesture
   = one undo step), `getDocument()` on the plugin bus, `replaceDocument()` for
   import, read access on `ctx.registry` (so B5's inspector can find B1's `Inspector`
   fragment), and `activeTool` + `forwardPointer()` in `kernel/registry` (shell's rail
   and plugin-rendered canvases must agree on the active tool without importing each
   other).
3. **Inter font is self-hosted** (`@fontsource-variable/inter`), not Google Fonts —
   keeps the "zero console errors" e2e gate strict and the app offline-capable.

## Two real bugs found by tests, now fixed — don't reintroduce

- `idb-keyval`'s `createStore()` provisions one object store per database. Documents
  and sidecars must use separate DB names (`maquette-documents`, `maquette-sidecar`),
  not one shared `maquette` DB with two stores.
- `measure()` must round `usedHeightMm` once and derive `fill` from the rounded value,
  not the raw float — otherwise a UI reporting both numbers quotes two different
  values.

## The boundary enforcement mechanism

`eslint.config.js` has depth-scoped `no-restricted-imports` rules per plugin nesting
level (`src/plugins/*/`, `*/*/`, `*/*/*/`) that block cross-plugin imports, shell
imports, kernel internals, and direct `idb-keyval`/`localStorage`/`indexedDB` access.
`test/boundaries.test.ts` lints 7 fixture files (`test/fixtures/boundaries/*.txt`)
through the real config — if you loosen a rule, this test fails. When adding new
plugin folder depths, extend the depth-scoped rules; don't just disable a warning.

## CI gotchas already hit and fixed

- `pnpm/action-setup@v4` needs a `packageManager` field in `package.json` (already set
  to `pnpm@10.33.0`) — don't remove it or CI dies in ~5s before install.
- The workflow triggers on `push: [dev, main]` + `pull_request` with concurrency keyed
  on `head_ref || ref` — this was fixed after an initial version double-ran every
  push. Don't widen `push.branches` back to `['**']` without re-checking for duplicate
  runs.

## What's next: Lot 1, one built-in at a time, in this order

Per SPEC.md §7, each is a self-contained work packet (§5 shape:
Manifest/Consumes/Registers/Behavior/Keyspace/Acceptance/Human-test/Do-not-touch):

1. **B1 `blocks-basic`** — 4 block types (body/headline/quote/image), Mini+Full views,
   Inspector fragments
2. **B2 `tools-basic`** — draw/move/delete tools, one command per gesture
3. **B3 `flatplan`** — the `/` view, spread cards, selection outline
4. **B4 `spread-editor`** — `/spread/:id`, guides, baseline grid, zoom/pan, snap flash
5. **B5 `inspector`** — the dock panel, spread + block level controls

**Gate:** after all five, run the human test script (SPEC.md §6.3, 10 numbered steps)
end-to-end. The kernel may still be amended during Lot 1 only via demonstrated
built-in need + a new ADR — after Lot 1 completes, a missing kernel API means STOP and
report BLOCKED (CLAUDE.md §12), never invent one.

## Process notes

- **Acceptance for every lot:** `git diff` shows zero files changed outside the
  plugin's folder except the one load-list line in `src/shell/plugins.ts`. I validated
  this mechanically in Lot 0 with a temporary demo plugin (registered in all 5
  registries, dispatched a command, rendered on paper) — build it, verify e2e, delete
  it, reconfirm clean boot. Worth repeating per built-in.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` is the full
  local gate; matches CI's two jobs (`verify`, `e2e`).
- No PR was created by me for Lot 0 — the user created it from the Claude Code UI.
  Same likely applies going forward; don't assume you should open one unless asked.

# ADR-001 — The kernel and what may live in it

- Status: accepted (Lot 0)
- Supersedes: the monolithic architecture of `MAQUETTE_PRD_SPEC.md` (v2)

## Context

Maquette v3 is an extension host. The base application must provide only what
plugins cannot provide for themselves, and it must freeze after Lot 1 so the
built-ins and the nine probes build on a stable contract.

## Decision

Membership criterion (SPEC.md §2), applied to every module in `src/kernel`:

> Something enters the kernel only if (a) two plugins must share it to
> interoperate, or (b) it defines the plugin contract itself, or (c) it is a
> seam that must be swappable without breaking plugins.

| Module | Criterion | Why |
| --- | --- | --- |
| `model` | (a) | Every plugin reads the same document. |
| `commands` | (b) | The bus IS the mutation contract. |
| `geometry` | (a) | Flatplan, editor and inspector must snap identically. |
| `text` | (c) | A real engine replaces `measure()` later (SPEC.md §9). |
| `selection` | (a) | Four built-ins read and write one selection. |
| `viewport` | (a) | Editor and overlays share one mm ↔ screen transform. |
| `pointer` | (a) | Every tool needs the same normalisation; pen/touch later. |
| `storage` | (c) | A cloud `StorageAdapter` replaces IndexedDB later. |
| `jobs` | (c) | `MockExecutor` is replaced by a real executor later. |
| `registry` | (b) | The five registries ARE the plugin surface. |
| `plugins` | (b) | Manifest, context, loader. |
| `canvas` | (a) | See "Canvas host placement" below. |

The litmus test holds: `src/shell/plugins.ts` is an empty list, the app boots to
an empty document, a desk and a placeholder view, and `pnpm build` is clean.

## Canvas host placement — a deviation, recorded

SPEC.md §4.7 places the canvas host in `src/shell`. But §4.5 rule 2 forbids a
plugin importing from the shell, and both B3 (`flatplan`) and B4
(`spread-editor`) must render *identical* paper — same geometry, same gutter
hairline, same block-view and overlay mounting. Two plugins sharing a thing they
cannot import is exactly criterion (a).

So the split is:

- `src/kernel/canvas/` — `SpreadPaper`, `BlockLayer`, `OverlayLayer`. The paper
  rectangle and the registry-driven mounting. Exported from `@/kernel`.
- `src/shell/CanvasHost.tsx` — the desk itself: the scrollable region, the tool
  rail, the error boundary, and the routed view slot. Shell-only, as §4.7 says.

The alternative — adding `@/shell/canvas` to the allowed plugin imports — was
rejected because it weakens the one rule (§4.5 rule 2) that everything else
rests on, and it does so permanently, for the convenience of two plugins.

## Consequences

- `src/kernel` never imports from `src/shell` or `src/plugins`. Enforced by
  ESLint (`no-restricted-imports`) and covered by `test/boundaries.test.ts`.
- The kernel freezes at Lot 1 completion. During Lot 1, an amendment requires a
  demonstrated built-in need plus a new ADR. After that, a task needing a
  missing kernel API must report BLOCKED (CLAUDE.md §12).

# Maquette

A two-layer page-design tool for printed material: a **flatplan** of greeked
spreads for mass and rhythm, and a **spread editor** with guides, snapping and
numeric control.

Maquette produces the ~95% — structure, composition, pacing, refined intent.
Final artwork is recreated in Scribus downstream. There is no press path and
never will be: the only export is document JSON.

This is a research probe. Its success metric is what it teaches us about
interaction modes for professional designers, not production utility.

## Architecture

Maquette is an **extension host**. The kernel provides only what plugins cannot
provide for themselves; every visible function — flatplan, spread editor,
inspector, block types, tools — ships as a plugin on the same contract as a
research probe.

The litmus test: the kernel with zero plugins boots to an empty shell, an empty
document and a placeholder view, and compiles clean. That is the current state
(Lot 0).

```
src/kernel/     the frozen-after-Lot-1 base: model, command bus, geometry,
                text seam, selection, viewport, pointer, storage, jobs,
                registries, plugin contract, canvas primitives
src/shell/      chrome, desk, routes, flags, and the plugin load list
src/plugins/    every feature, built-in and probe alike (empty in Lot 0)
```

Read `SPEC.md` first, then `docs/adr/`, then `CLAUDE.md` before changing
anything.

## Getting started

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

## Checks

```sh
pnpm typecheck    # tsc --build, strict, no `any` in the kernel
pnpm lint         # includes the plugin boundary rules (SPEC.md §4.5)
pnpm test         # vitest — kernel unit tests + the boundary fixture test
pnpm e2e          # playwright — the Lot 0 boot gate
pnpm build
```

## Deployment

`vercel.json` is committed and the app is Vercel-ready. Nothing is deployed;
development is local.

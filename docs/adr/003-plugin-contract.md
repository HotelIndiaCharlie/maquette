# ADR-003 — The plugin contract

- Status: accepted (Lot 0)

## Context

Every visible function ships as a plugin, including the basics. The contract has
to be strict enough that a research probe and a built-in are genuinely the same
kind of thing, and mechanical enough that a weaker implementer model cannot
drift out of it by accident.

## Decision

A plugin is a folder, a manifest and one line in the load list.

```
src/plugins/<id>/index.ts   →   export const plugin: MaquettePlugin
src/shell/plugins.ts        →   one entry in PLUGIN_LIST
```

Four rules, all mechanically checked:

1. **One folder, one entry.** `folder name === plugin.id`, kebab-case, asserted
   at load by `assertValidManifest`.
2. **Import only `@/kernel`, `@/components/ui`, `@/styles`, own folder.**
   Enforced by `no-restricted-imports` in `eslint.config.js`, including
   depth-scoped rules that catch relative escapes (`../` from a plugin's top
   level, `../../` one level down, and so on). `test/boundaries.test.ts` lints
   seven violating fixtures through the real config, so loosening a rule fails
   CI.
3. **No direct persistence.** `localStorage`, `indexedDB` and `idb-keyval` are
   all forbidden from plugin code; sidecars are the only door.
4. **Removal leaves the app running.** The loader tracks every registration a
   plugin makes and disposes them on unload, so the runtime honours the same
   promise the build does.

### Failure is contained

Each `register()` runs in a try/catch. A plugin that throws has its
half-finished registrations rolled back, is marked `failed`, and raises a toast
through `onError`. The rest of the list still loads. A plugin component that
throws while *rendering* is caught by the shell's `ErrorBoundary`. Neither path
produces a white screen.

### PluginContext — the deviations from §4.5

`ctx.registry.*` exposes the full `Registry` (register / list / get / subscribe),
not just `register`. B5 (`inspector`) must find the block type's `Inspector`
fragment registered by B1 without importing B1 — read access to the registry is
how one plugin composes with another's contribution.

`ctx.bus` also carries `transact` and `getDocument` (see ADR-002) and
`subscribeLog` (P9 mines the log). Subscriptions taken through `ctx.bus` are
tracked and disposed with the plugin.

### activeTool is kernel

The shell's tool rail renders the tools registry; the canvas surfaces that
receive pointer events are rendered by *plugins*. Both must agree on which tool
is active, and neither may import the other — criterion (a). So
`activeTool` and `forwardPointer(phase, event, layer)` live in
`kernel/registry`.

## Consequences

The acceptance rule for every subsequent lot is checkable with `git diff`:
adding a feature modifies zero files outside its folder, except one line in
`src/shell/plugins.ts`.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE EXAMPLE PLUGIN — a reference, not a feature.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  WHY THIS EXISTS. `docs/plugin-api.md` tells a plugin author what the kernel
 *  offers. This folder proves it: it is compiled and boundary-linted on every
 *  CI run, so it is the one artefact an author can copy that is GUARANTEED to
 *  compile against the real kernel. See docs/adr/006-plugin-authoring-toolkit.md.
 *
 *  ┌───────────────────────────────────────────────────────────────────────┐
 *  │  THIS PLUGIN IS DELIBERATELY **NOT** IN `PLUGIN_LIST`.                │
 *  │  See the matching note in src/shell/plugins.ts. It is a reference     │
 *  │  that must keep compiling, not a feature that should load. Do not     │
 *  │  "fix" the omission.                                                  │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 *  Its id is `example`, not `_example` or `__template__`, because
 *  `PLUGIN_ID_PATTERN` is /^[a-z0-9]+(?:-[a-z0-9]+)*$/ and the contract is
 *  folder name === id (SPEC.md §4.5 rule 1).
 *
 *  It touches every part of the contract exactly once: all five registries,
 *  one command through the bus, one sidecar key read and written, and paper.
 *  Every comment below names the rule the line satisfies.
 *
 *  Scaffold a real plugin from it with:  pnpm new:plugin <id>
 */

// CLAUDE.md §3 / SPEC.md §4.5 rule 2 — a plugin imports the kernel PUBLIC API
// and nothing else. `@/kernel/registry/types` would be a lint error; so would
// `@/shell/flags`, `@/plugins/blocks-basic`, and `idb-keyval`.
import type { Dispose, MaquettePlugin, PluginContext } from '@/kernel';
import { disposeAll } from '@/kernel';

import { exampleBlockType } from './ExampleBlock';
import { ExampleOverlay } from './ExampleOverlay';
import { createExamplePanel } from './ExamplePanel';
import { ExampleView } from './ExampleView';
import { createExampleTool } from './ExampleTool';

// The sidecar keyspace this plugin owns — packet part 5.
export { PREFS_KEY, PREFS_NAMESPACE, type ExamplePrefs } from './keyspace';

function register(ctx: PluginContext): Dispose {
  // ── the five registries ────────────────────────────────────────────────
  // SPEC.md §4.4. Always register through `ctx.registry.*`, NEVER the bare
  // `blockTypes` / `tools` / … exports: the ctx facade tracks each
  // registration and disposes it on unload, which is what makes SPEC.md §4.5
  // rule 4 ("removal leaves the app running") true at RUNTIME and not just at
  // build time. Registering on the bare export leaks past unload.
  const disposers: Dispose[] = [
    // 1. blockTypes — a kind of thing that lives on paper, with a greeked
    //    Layer-1 MiniView and a typographic Layer-2 FullView.
    ctx.registry.blockTypes.register(exampleBlockType),

    // 2. tools — a mode the shell's tool rail can select. Its pointer handlers
    //    only ever fire through the kernel's `forwardPointer`, so the tool sees
    //    millimetres in spread space and never a client coordinate (§4.6).
    ctx.registry.tools.register(createExampleTool(ctx)),

    // 3. overlays — drawn ABOVE paper. `layer` says where, `zIndex` says in
    //    what order. The overlay layer is pointer-events-none; an overlay that
    //    is an affordance re-enables them on its own element.
    ctx.registry.overlays.register({
      id: 'example-margins',
      layer: 'spread',
      zIndex: 10,
      View: ExampleOverlay,
    }),

    // 4. panels — docks into the shell's panel slot (right rail ≥760px,
    //    bottom sheet below). `order` sorts it against other plugins' panels.
    ctx.registry.panels.register(createExamplePanel(ctx)),

    // 5. views — owns a route. The shell holds no screens of its own; every
    //    route except the placeholder comes from this registry (§4.4).
    ctx.registry.views.register({
      id: 'example-view',
      route: '/playground/example',
      View: ExampleView,
    }),
  ];

  // CLAUDE.md §3 / SPEC.md §4.5 rule 4 — anything taken through `ctx.registry`
  // or `ctx.bus.subscribe*` is disposed for us. Return a disposer for anything
  // else (a window listener, a timer, a `ctx.selection.subscribe`). Returning
  // the registry disposers too is harmless and makes the intent explicit.
  return disposeAll(...disposers);
}

export const plugin: MaquettePlugin = {
  // folder name === id, kebab-case, matching PLUGIN_ID_PATTERN (§4.5 rule 1).
  id: 'example',
  name: 'Example plugin',
  version: '0.1.0',
  // No `flag`: built-ins are unflagged. Every probe (SPEC.md §8) sets one, and
  // then loads only when `ctx.flags.get(name)` is true.
  register,
};

export default plugin;

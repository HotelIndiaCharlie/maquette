/**
 * Blocks basic — SPEC.md §5 work packet: docs/packets/blocks-basic.md
 *
 * Four block types — body, headline, quote, image — each with a greeked
 * Layer-1 MiniView, a typographic Layer-2 FullView, and an Inspector
 * fragment. Plus one playground view (§4.7), so the plugin is testable
 * before B2–B4 exist.
 *
 * A plugin lives entirely in src/plugins/blocks-basic/ and imports only
 * `@/kernel`, `@/components/ui`, `@/styles` and its own folder (SPEC.md
 * §4.5). All mutations go through `ctx.bus.dispatch`; B1's keyspace is none,
 * so `ctx.storage` is never called (packet §5).
 */
import type { Dispose, MaquettePlugin, PluginContext } from '@/kernel';
import { disposeAll } from '@/kernel';

import { createBodyBlockType } from './BodyBlock';
import { createHeadlineBlockType } from './HeadlineBlock';
import { imageBlockType } from './ImageBlock';
import { PlaygroundView } from './PlaygroundView';
import { createQuoteBlockType } from './QuoteBlock';

function register(ctx: PluginContext): Dispose {
  // Register through `ctx.registry.*`, never the bare `blockTypes` export —
  // the bare one leaks past unload (packet §3.2).
  const disposers: Dispose[] = [
    ctx.registry.blockTypes.register(createBodyBlockType(ctx)),
    ctx.registry.blockTypes.register(createHeadlineBlockType(ctx)),
    ctx.registry.blockTypes.register(createQuoteBlockType(ctx)),
    ctx.registry.blockTypes.register(imageBlockType),

    ctx.registry.views.register({
      id: 'blocks-basic-playground',
      route: '/playground/blocks-basic',
      View: PlaygroundView,
    }),
  ];

  return disposeAll(...disposers);
}

export const plugin: MaquettePlugin = {
  id: 'blocks-basic',
  name: 'Basic blocks',
  version: '0.1.0',
  // No `flag`: built-ins are unflagged (SPEC.md §8).
  register,
};

export default plugin;

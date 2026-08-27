/**
 * A panel — SPEC.md §4.4 — and the sidecar pattern, SPEC.md §4.8 / CLAUDE.md §5.
 *
 * THE RULE THIS FILE DEMONSTRATES: plugin data lives in `ctx.storage(ns)`
 * sidecars, NEVER inside DocumentV1, and never in `localStorage` / `indexedDB` /
 * `idb-keyval` directly — all three are lint errors that cite the rule number.
 *
 * A PanelDef's View takes no props, so anything it needs from `ctx` is bound at
 * register time by a factory. That is the pattern to copy: a component that
 * reaches for a module-level singleton cannot be unit-tested against a memory
 * sidecar.
 */
import { useEffect, useState } from 'react';
import type { PanelDef, PluginContext } from '@/kernel';
import { useSelection } from '@/kernel';
import { Button } from '@/components/ui/button';
import { PREFS_KEY, PREFS_NAMESPACE, type ExamplePrefs } from './keyspace';

export function createExamplePanel(ctx: PluginContext): PanelDef {
  // Namespaced to this plugin: the kernel prefixes every key with
  // `${pluginId}:${namespace}`, so this cannot collide with another plugin's
  // data — and cannot read it either.
  const store = ctx.storage<ExamplePrefs>(PREFS_NAMESPACE);

  const View: PanelDef['View'] = () => {
    const selection = useSelection();
    const [prefs, setPrefs] = useState<ExamplePrefs | null>(null);

    useEffect(() => {
      let live = true;
      // Sidecar reads are ASYNC — there is no synchronous read. Render a
      // sensible default first, then update when the promise resolves.
      void store.get(PREFS_KEY).then((v) => {
        if (live) setPrefs(v ?? { blocksAdded: 0 });
      });
      return () => {
        live = false;
      };
    }, []);

    const bump = () => {
      const next: ExamplePrefs = { blocksAdded: (prefs?.blocksAdded ?? 0) + 1 };
      setPrefs(next);
      void store.set(PREFS_KEY, next);
    };

    return (
      <div className="flex flex-col gap-2">
        {/* The one selection every layer agrees on (§4.6). The kernel prunes
            it when blocks are removed, so no plugin defends against ghost ids. */}
        <p className="font-ui text-micro text-ink-soft">
          {selection.blockIds.length === 0
            ? 'Nothing selected.'
            : `${selection.blockIds.length} selected`}
        </p>
        <p className="font-ui text-micro text-ink-soft">
          Sidecar count: {prefs ? prefs.blocksAdded : '…'}
        </p>
        {/* Vendored shadcn, restyled through tokens and variants ONLY
            (CLAUDE.md §7). Never edit src/components/ui from a plugin — it is
            outside your folder. */}
        <Button size="sm" variant="outline" onClick={bump}>
          Bump
        </Button>
      </div>
    );
  };

  return { id: 'example-panel', title: 'Example', order: 900, View };
}

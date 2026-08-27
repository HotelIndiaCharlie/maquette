/**
 * Plugin loader — SPEC.md §4.5.
 *
 * · flag-gated entries are skipped at load
 * · each register() is wrapped: a broken plugin disables itself, visibly,
 *   never a white screen
 * · everything a plugin registered is disposed when it is unloaded, so
 *   "removal leaves the app running" is true at runtime as well as at build
 */
import { dispatchAs, getDocument, getLog, subscribeDoc, subscribeLog, transactAs } from '../commands/bus';
import type { Dispose } from '../dispose';
import type { JobExecutor } from '../jobs/types';
import { registries } from '../registry';
import type { Registry } from '../registry/types';
import { selection } from '../selection';
import { sidecarFactoryFor } from '../storage/indexeddb';
import type { SidecarFactory } from '../storage/types';
import { textApi } from '../text';
import { viewport } from '../viewport';
import { assertUniqueIds, assertValidManifest } from './boundaries';
import type { FlagsApi, MaquettePlugin, PluginContext, PluginRegistryApi } from './types';

export type PluginStatus = 'active' | 'skipped' | 'failed';

export interface LoadedPlugin {
  plugin: MaquettePlugin;
  status: PluginStatus;
  /** Why it was skipped, or what it threw. */
  reason?: string;
  error?: unknown;
}

export interface PluginHostOptions {
  flags: FlagsApi;
  jobs: JobExecutor;
  /** Injectable so tests need no IndexedDB. Defaults to the real sidecar. */
  storageFactory?: (pluginId: string) => SidecarFactory;
  /** The shell shows a toast here (SPEC.md §4.5). */
  onError?: (plugin: MaquettePlugin, err: unknown) => void;
}

export interface PluginHost {
  loaded: ReadonlyArray<LoadedPlugin>;
  active(): ReadonlyArray<MaquettePlugin>;
  unload(id: string): void;
  unloadAll(): void;
}

/** A per-plugin facade over the registries that remembers what to undo. */
function trackedRegistries(collect: (d: Dispose) => void): PluginRegistryApi {
  const wrap = <T extends { id: string }>(reg: Registry<T>): Registry<T> => ({
    register(def) {
      const dispose = reg.register(def);
      collect(dispose);
      return dispose;
    },
    list: reg.list,
    get: reg.get,
    subscribe: reg.subscribe,
  });

  return {
    blockTypes: wrap(registries.blockTypes),
    tools: wrap(registries.tools),
    overlays: wrap(registries.overlays),
    panels: wrap(registries.panels),
    views: wrap(registries.views),
  };
}

export function createPluginContext(
  pluginId: string,
  opts: PluginHostOptions,
  collect: (d: Dispose) => void,
): PluginContext {
  const storage = (opts.storageFactory ?? sidecarFactoryFor)(pluginId);

  return {
    pluginId,
    registry: trackedRegistries(collect),
    bus: {
      dispatch: (cmd) => dispatchAs(pluginId, cmd),
      transact: (label, fn) => transactAs(pluginId, label, fn),
      getDocument,
      subscribeDoc: (cb) => {
        const d = subscribeDoc(cb);
        collect(d);
        return d;
      },
      getLog,
      subscribeLog: (cb) => {
        const d = subscribeLog(cb);
        collect(d);
        return d;
      },
    },
    selection,
    viewport,
    storage,
    jobs: opts.jobs,
    text: textApi,
    flags: opts.flags,
  };
}

export function loadPlugins(
  plugins: ReadonlyArray<MaquettePlugin>,
  opts: PluginHostOptions,
): PluginHost {
  assertUniqueIds(plugins);

  const loaded: LoadedPlugin[] = [];
  const disposers = new Map<string, Dispose[]>();

  for (const plugin of plugins) {
    const collected: Dispose[] = [];
    disposers.set(plugin.id, collected);
    const collect = (d: Dispose) => collected.push(d);

    try {
      assertValidManifest(plugin);

      if (plugin.flag && !opts.flags.get(plugin.flag)) {
        loaded.push({ plugin, status: 'skipped', reason: `flag "${plugin.flag}" is off` });
        continue;
      }

      const ctx = createPluginContext(plugin.id, opts, collect);
      const dispose = plugin.register(ctx);
      if (typeof dispose === 'function') collect(dispose);
      loaded.push({ plugin, status: 'active' });
    } catch (err) {
      // The plugin disables itself: undo whatever it managed to register.
      for (const d of collected.splice(0).reverse()) safely(d);
      loaded.push({
        plugin,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
        error: err,
      });
      opts.onError?.(plugin, err);
    }
  }

  const unload = (id: string) => {
    const list = disposers.get(id);
    if (!list) return;
    for (const d of list.splice(0).reverse()) safely(d);
    disposers.delete(id);
    const entry = loaded.find((l) => l.plugin.id === id);
    if (entry && entry.status === 'active') entry.status = 'skipped';
  };

  return {
    loaded,
    active: () => loaded.filter((l) => l.status === 'active').map((l) => l.plugin),
    unload,
    unloadAll: () => {
      for (const id of [...disposers.keys()]) unload(id);
    },
  };
}

function safely(fn: Dispose): void {
  try {
    fn();
  } catch {
    /* a failing disposer must not block the rest */
  }
}

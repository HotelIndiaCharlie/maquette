/** The plugin contract — SPEC.md §4.5. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPlugins } from './loader';
import { PluginContractError } from './boundaries';
import type { MaquettePlugin, PluginContext } from './types';
import { createMemorySidecarSpace } from '../storage/memory';
import { createMockExecutor } from '../jobs/mock';
import { __resetBusForTests, getLog } from '../commands/bus';
import { blockTypes, overlays, panels, tools, views } from '../registry';
import type { Block, Rect } from '../model/types';

const Noop = () => null;
const anyBlock = (frame: Rect): Block => ({ id: 'x', type: 'demo', frame });

function opts(overrides: Partial<Parameters<typeof loadPlugins>[1]> = {}) {
  const { factoryFor } = createMemorySidecarSpace();
  return {
    flags: { get: () => false },
    jobs: createMockExecutor({ seed: 1 }),
    storageFactory: factoryFor,
    ...overrides,
  };
}

function plugin(id: string, register: MaquettePlugin['register'], flag?: string): MaquettePlugin {
  return { id, name: id, version: '1.0.0', ...(flag ? { flag } : {}), register };
}

// Registries are module singletons; every case unloads its own host, which is
// what keeps them clean between tests (and is itself the removal guarantee).
beforeEach(() => {
  __resetBusForTests();
});

describe('loadPlugins', () => {
  it('calls register once per plugin with its own id', () => {
    const seen: string[] = [];
    const host = loadPlugins(
      [
        plugin('alpha', (ctx) => void seen.push(ctx.pluginId)),
        plugin('beta', (ctx) => void seen.push(ctx.pluginId)),
      ],
      opts(),
    );
    expect(seen).toEqual(['alpha', 'beta']);
    expect(host.active().map((p) => p.id)).toEqual(['alpha', 'beta']);
    host.unloadAll();
  });

  it('skips a flag-gated plugin when the flag is off', () => {
    const register = vi.fn();
    const host = loadPlugins([plugin('probe', register, 'sketch')], opts());
    expect(register).not.toHaveBeenCalled();
    expect(host.loaded[0]!.status).toBe('skipped');
    host.unloadAll();
  });

  it('loads a flag-gated plugin when the flag is on', () => {
    const register = vi.fn();
    const host = loadPlugins(
      [plugin('probe', register, 'sketch')],
      opts({ flags: { get: (n: string) => n === 'sketch' } }),
    );
    expect(register).toHaveBeenCalledOnce();
    expect(host.loaded[0]!.status).toBe('active');
    host.unloadAll();
  });

  it('a broken plugin disables itself, visibly, and the rest still load', () => {
    const onError = vi.fn();
    const later = vi.fn();
    const host = loadPlugins(
      [
        plugin('broken', (ctx) => {
          ctx.registry.panels.register({ id: 'ghost', title: 'Ghost', order: 1, View: Noop });
          throw new Error('kaboom');
        }),
        plugin('fine', later),
      ],
      opts({ onError }),
    );

    expect(host.loaded[0]!.status).toBe('failed');
    expect(host.loaded[0]!.reason).toBe('kaboom');
    expect(onError).toHaveBeenCalledOnce();
    expect(later).toHaveBeenCalledOnce();

    // and it took its half-finished registrations down with it
    expect(panels.get('ghost')).toBeUndefined();
    host.unloadAll();
  });

  it('rejects a malformed manifest', () => {
    const host = loadPlugins([plugin('Not Kebab Case', () => undefined)], opts());
    expect(host.loaded[0]!.status).toBe('failed');
    expect(host.loaded[0]!.error).toBeInstanceOf(PluginContractError);
  });

  it('rejects duplicate plugin ids outright', () => {
    expect(() =>
      loadPlugins([plugin('same', () => undefined), plugin('same', () => undefined)], opts()),
    ).toThrow(PluginContractError);
  });

  it('unload removes everything the plugin registered', () => {
    const host = loadPlugins(
      [
        plugin('full', (ctx) => {
          ctx.registry.blockTypes.register({
            id: 'demo',
            label: 'Demo',
            createDefault: anyBlock,
            MiniView: Noop,
            FullView: Noop,
          });
          ctx.registry.tools.register({ id: 'demo-tool', label: 'T', icon: null, layer: 'both' });
          ctx.registry.overlays.register({ id: 'demo-ov', layer: 'spread', zIndex: 1, View: Noop });
          ctx.registry.panels.register({ id: 'demo-p', title: 'P', order: 1, View: Noop });
          ctx.registry.views.register({ id: 'demo-v', route: '/demo', View: Noop });
        }),
      ],
      opts(),
    );

    expect(blockTypes.get('demo')).toBeDefined();
    host.unload('full');

    expect(blockTypes.get('demo')).toBeUndefined();
    expect(tools.get('demo-tool')).toBeUndefined();
    expect(overlays.get('demo-ov')).toBeUndefined();
    expect(panels.get('demo-p')).toBeUndefined();
    expect(views.get('demo-v')).toBeUndefined();
  });

  it('unload also drops the plugin`s bus subscriptions', () => {
    const seen: number[] = [];
    const host = loadPlugins(
      [plugin('watcher', (ctx) => void ctx.bus.subscribeDoc(() => seen.push(1)))],
      opts(),
    );
    host.unload('watcher');
    // nothing left to notify
    expect(seen).toEqual([]);
  });
});

describe('PluginContext', () => {
  function contextOf(id: string, extra: Parameters<typeof opts>[0] = {}): PluginContext {
    let captured!: PluginContext;
    const host = loadPlugins([plugin(id, (ctx) => void (captured = ctx))], opts(extra));
    host.unloadAll();
    return captured;
  }

  it('stamps dispatch with the plugin id', () => {
    const ctx = contextOf('tools-basic');
    ctx.bus.dispatch({ type: 'spread/add' });
    expect(getLog().at(-1)!.source).toBe('tools-basic');
  });

  it('groups a transaction under the plugin id', () => {
    const ctx = contextOf('sketch');
    ctx.bus.transact('Three shapes', () => {
      ctx.bus.dispatch({ type: 'spread/add' });
      ctx.bus.dispatch({ type: 'spread/add' });
    });
    const group = getLog().at(-1)!.groupId!;
    expect(group.startsWith('sketch:')).toBe(true);
    expect(getLog().filter((e) => e.groupId === group)).toHaveLength(2);
  });

  it('namespaces storage to the plugin', async () => {
    const space = createMemorySidecarSpace();
    const ctx = contextOf('annotation', { storageFactory: space.factoryFor });
    await ctx.storage<string>('marks').set('m1', 'red box');
    expect([...space.space.keys()]).toEqual(['annotation:marks:m1']);
  });

  it('exposes exactly the seams the contract promises', () => {
    const ctx = contextOf('probe');
    expect(Object.keys(ctx).sort()).toEqual([
      'bus',
      'flags',
      'jobs',
      'pluginId',
      'registry',
      'selection',
      'storage',
      'text',
      'viewport',
    ]);
  });
});

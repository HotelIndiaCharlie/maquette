/**
 * The reference plugin, held to the contract it demonstrates.
 *
 * If this test fails, `pnpm new:plugin` is scaffolding something broken and
 * every plugin-authoring session copying this folder inherits the break.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLUGIN_ID_PATTERN,
  assertValidManifest,
  blockTypes,
  createMemorySidecarSpace,
  getLog,
  loadPlugins,
  mockExecutor,
  overlays,
  panels,
  registries,
  tools,
  views,
} from '@/kernel';
import { plugin } from './index';
import { PREFS_KEY, PREFS_NAMESPACE, type ExamplePrefs } from './keyspace';
import { exampleBlockType } from './ExampleBlock';

const flags = { get: () => false };

function load() {
  const sidecars = createMemorySidecarSpace();
  const host = loadPlugins([plugin], {
    flags,
    jobs: mockExecutor,
    storageFactory: (id) => sidecars.factoryFor(id),
  });
  return { host, sidecars };
}

function registryIds() {
  return {
    blockTypes: blockTypes.list().map((d) => d.id),
    tools: tools.list().map((d) => d.id),
    overlays: overlays.list().map((d) => d.id),
    panels: panels.list().map((d) => d.id),
    views: views.list().map((d) => d.id),
  };
}

describe('the example plugin manifest', () => {
  it('is valid against the contract', () => {
    expect(() => assertValidManifest(plugin)).not.toThrow();
  });

  it('has an id that matches PLUGIN_ID_PATTERN and its folder name', () => {
    // The folder cannot be `_example` or `__template__` — the pattern forbids
    // both, and folder name === id (SPEC.md §4.5 rule 1).
    expect(plugin.id).toBe('example');
    expect(PLUGIN_ID_PATTERN.test(plugin.id)).toBe(true);
  });

  it('is unflagged, like every built-in', () => {
    expect(plugin.flag).toBeUndefined();
  });
});

describe('register() and its disposer', () => {
  beforeEach(() => {
    // Registries are module singletons; make sure a previous test left none behind.
    for (const reg of Object.values(registries)) {
      expect(reg.list()).toHaveLength(0);
    }
  });

  it('registers in all five registries, and unload removes every one', () => {
    const { host } = load();

    expect(host.loaded[0]?.status).toBe('active');
    expect(registryIds()).toEqual({
      blockTypes: ['example'],
      tools: ['example-draw'],
      overlays: ['example-margins'],
      panels: ['example-panel'],
      views: ['example-view'],
    });

    // SPEC.md §4.5 rule 4, at runtime: removal leaves the app running.
    host.unloadAll();
    expect(registryIds()).toEqual({
      blockTypes: [],
      tools: [],
      overlays: [],
      panels: [],
      views: [],
    });
  });

  it('dispatches exactly one command for one completed gesture', () => {
    const { host } = load();
    try {
      const tool = tools.get('example-draw');
      expect(tool).toBeDefined();

      const before = getLog().length;
      const raw = { clientX: 0, clientY: 0 } as unknown as PointerEvent;
      const spreadId = 'spread_1';

      tool?.onDown?.({ mm: { x: 20, y: 20 }, spreadId, raw });
      tool?.onMove?.({ mm: { x: 60, y: 60 }, spreadId, raw });
      tool?.onMove?.({ mm: { x: 90, y: 90 }, spreadId, raw });
      tool?.onUp?.({ mm: { x: 120, y: 120 }, spreadId, raw });

      // CLAUDE.md §4 — one command per completed gesture. onDown and two
      // onMoves in the middle of the drag must add NOTHING to the log.
      const added = getLog().slice(before);
      expect(added).toHaveLength(1);
      expect(added[0]?.cmd.type).toBe('block/add');
      // ctx.bus.dispatch stamps the plugin id, so the log names who asked.
      expect(added[0]?.source).toBe('example');
    } finally {
      host.unloadAll();
    }
  });

  it('round-trips its one sidecar key, namespaced to the plugin id', async () => {
    const { host, sidecars } = load();
    try {
      const store = sidecars.factoryFor(plugin.id)<ExamplePrefs>(PREFS_NAMESPACE);
      expect(await store.get(PREFS_KEY)).toBeNull();

      await store.set(PREFS_KEY, { blocksAdded: 3 });
      expect(await store.get(PREFS_KEY)).toEqual({ blocksAdded: 3 });

      // SPEC.md §4.8 — the kernel owns the prefix, so a plugin cannot collide
      // with, or read, another plugin's data.
      expect([...sidecars.space.keys()]).toEqual([
        `${plugin.id}:${PREFS_NAMESPACE}:${PREFS_KEY}`,
      ]);
    } finally {
      host.unloadAll();
    }
  });
});

describe('the block type', () => {
  it('createDefault returns a complete block with the stated defaults', () => {
    const block = exampleBlockType.createDefault({ x: 10, y: 10, w: 60, h: 40 });
    expect(block.type).toBe('example');
    expect(block.id).toMatch(/^example_/);
    expect(block.frame).toEqual({ x: 10, y: 10, w: 60, h: 40 });
    expect(block.sizePt).toBe(9.5);
    expect(block.leadingPt).toBe(12);
    expect(block.align).toBe('left');
  });

  it('provides both layers and an Inspector fragment for B5 to find', () => {
    expect(exampleBlockType.MiniView).toBeTypeOf('function');
    expect(exampleBlockType.FullView).toBeTypeOf('function');
    expect(exampleBlockType.Inspector).toBeTypeOf('function');
  });
});

/** Sidecar namespacing + autosave — SPEC.md §4.8, §4.11. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, createStore, keys } from 'idb-keyval';
import { createSidecar, indexedDbAdapter, sidecarFactoryFor } from './indexeddb';
import { createMemoryAdapter, createMemorySidecarSpace } from './memory';
import { startAutosave } from './autosave';
import { __resetBusForTests, dispatch, getDocument } from '../commands/bus';
import { createSeedDocument } from '../model/seed';

const sidecarIdb = createStore('maquette-sidecar', 'sidecar');
const docsIdb = createStore('maquette-documents', 'documents');

beforeEach(async () => {
  __resetBusForTests();
  await clear(sidecarIdb);
  await clear(docsIdb);
});

describe('sidecar namespacing', () => {
  it('keys are prefixed `${pluginId}:${ns}:`', async () => {
    const store = createSidecar<string>('annotation', 'marks');
    await store.set('m1', 'a red box');
    expect(await keys(sidecarIdb)).toEqual(['annotation:marks:m1']);
  });

  it('two plugins cannot see each other, even on the same key', async () => {
    const mine = createSidecar<string>('annotation', 'marks');
    const yours = createSidecar<string>('sketch', 'marks');

    await mine.set('m1', 'mine');
    await yours.set('m1', 'yours');

    expect(await mine.get('m1')).toBe('mine');
    expect(await yours.get('m1')).toBe('yours');
    expect(await mine.list()).toEqual(['m1']);
  });

  it('two namespaces in one plugin stay separate', async () => {
    const marks = createSidecar<string>('annotation', 'marks');
    const sessions = createSidecar<string>('annotation', 'sessions');

    await marks.set('a', '1');
    await sessions.set('b', '2');

    expect(await marks.list()).toEqual(['a']);
    expect(await sessions.list()).toEqual(['b']);
    expect(await marks.get('b')).toBeNull();
  });

  it('list() strips the prefix and honours a key prefix filter', async () => {
    const store = createSidecar<number>('mining', 'rules');
    await store.set('col:1', 1);
    await store.set('col:2', 2);
    await store.set('lead:1', 3);

    expect(await store.list()).toEqual(['col:1', 'col:2', 'lead:1']);
    expect(await store.list('col:')).toEqual(['col:1', 'col:2']);
  });

  it('get() returns null for a missing key, and remove() is idempotent', async () => {
    const store = createSidecar<string>('p', 'ns');
    expect(await store.get('nope')).toBeNull();
    await store.remove('nope');
    await store.set('k', 'v');
    await store.remove('k');
    expect(await store.get('k')).toBeNull();
  });

  it('the per-plugin factory binds the id', async () => {
    const factory = sidecarFactoryFor('copyflow');
    await factory<string>('manuscripts').set('draft', 'text');
    expect(await keys(sidecarIdb)).toEqual(['copyflow:manuscripts:draft']);
  });

  it('refuses an empty plugin id or namespace', () => {
    expect(() => createSidecar('', 'ns')).toThrow();
    expect(() => createSidecar('p', '')).toThrow();
  });

  it('the memory space namespaces identically', async () => {
    const { space, factoryFor } = createMemorySidecarSpace();
    await factoryFor('snapshot')<string>('pins').set('a', 'x');
    expect([...space.keys()]).toEqual(['snapshot:pins:a']);
  });
});

describe('document adapter', () => {
  it('round-trips a document through IndexedDB', async () => {
    const doc = createSeedDocument('Round trip');
    await indexedDbAdapter.save(doc);
    expect(await indexedDbAdapter.load(doc.id)).toEqual(doc);
  });

  it('returns null for an unknown id', async () => {
    expect(await indexedDbAdapter.load('nope')).toBeNull();
  });

  it('lists summaries newest first, and removes', async () => {
    const a = { ...createSeedDocument('A'), id: 'a', updatedAt: 1 };
    const b = { ...createSeedDocument('B'), id: 'b', updatedAt: 2 };
    await indexedDbAdapter.save(a);
    await indexedDbAdapter.save(b);

    expect((await indexedDbAdapter.list()).map((s) => s.id)).toEqual(['b', 'a']);

    await indexedDbAdapter.remove('b');
    expect((await indexedDbAdapter.list()).map((s) => s.id)).toEqual(['a']);
  });

  it('refuses to load a stored record that is not schema-valid', async () => {
    // Corrupt data must surface, not be silently half-loaded: boot() catches
    // this and seeds a fresh document instead.
    await indexedDbAdapter.save({ id: 'corrupt', schemaVersion: 99 } as never);
    await expect(indexedDbAdapter.load('corrupt')).rejects.toThrow(/schemaVersion/);

    await indexedDbAdapter.save({ id: 'partial', schemaVersion: 1 } as never);
    await expect(indexedDbAdapter.load('partial')).rejects.toThrow();
  });
});

describe('autosave', () => {
  it('debounces 500 ms and writes the latest document', async () => {
    vi.useFakeTimers();
    const adapter = createMemoryAdapter();
    const saveSpy = vi.spyOn(adapter, 'save');
    const handle = startAutosave(adapter);

    dispatch({ type: 'spread/add' });
    dispatch({ type: 'spread/add' });
    expect(saveSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(saveSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0]![0].spreads).toHaveLength(5);

    handle.stop();
    vi.useRealTimers();
  });

  it('stops writing once stopped', async () => {
    vi.useFakeTimers();
    const adapter = createMemoryAdapter();
    const saveSpy = vi.spyOn(adapter, 'save');
    const handle = startAutosave(adapter);
    handle.stop();

    dispatch({ type: 'spread/add' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('flush() writes immediately', async () => {
    const adapter = createMemoryAdapter();
    const handle = startAutosave(adapter);

    dispatch({ type: 'spread/add' });
    await handle.flush();

    expect(await adapter.load(getDocument().id)).toMatchObject({ id: getDocument().id });
    handle.stop();
  });
});

/** MockExecutor + applyChangeSet — SPEC.md §4.9, §4.11. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockExecutor, MOCK_MAX_LATENCY_MS, MOCK_MIN_LATENCY_MS } from './mock';
import { applyChangeSet } from './changeset';
import { changeSetTouches, JobCancelledError, type ChangeSet } from './types';
import {
  __resetBusForTests,
  canUndo,
  dispatch,
  getDocument,
  getLog,
  undo,
} from '../commands/bus';
import type { Block } from '../model/types';

const seededBlocks: Block[] = [
  { id: 'b1', type: 'body', frame: { x: 20, y: 31, w: 60, h: 40 } },
  { id: 'b2', type: 'quote', frame: { x: 100, y: 77, w: 60, h: 40 } },
  { id: 'locked', type: 'image', frame: { x: 250, y: 55, w: 60, h: 40 } },
];

function seed() {
  __resetBusForTests();
  for (const block of seededBlocks) {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: { ...block } });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

function executor() {
  return createMockExecutor({ seed: 42 });
}

const nudgeRequest = (locked: string[] = []) => ({
  kind: 'nudge-baselines',
  payload: {},
  scope: { spreadIds: ['spread_1'], lockedBlockIds: locked },
});

describe('MockExecutor', () => {
  it('takes a seeded 2–8 s and resolves with a ChangeSet', async () => {
    const job = executor().run(nudgeRequest());
    expect(job.status()).toBe('running');

    await vi.advanceTimersByTimeAsync(MOCK_MIN_LATENCY_MS - 1);
    expect(job.status()).toBe('running');

    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    expect(job.status()).toBe('done');

    const cs = await job.result;
    expect(cs.groups.length).toBeGreaterThan(0);
  });

  it('is deterministic: the same seed gives the same result', async () => {
    const a = createMockExecutor({ seed: 7 }).run(nudgeRequest());
    const b = createMockExecutor({ seed: 7 }).run(nudgeRequest());
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    const [ra, rb] = [await a.result, await b.result];
    expect(ra.groups.map((g) => g.commands)).toEqual(rb.groups.map((g) => g.commands));
  });

  it('emits progress ticks', async () => {
    const job = executor().run(nudgeRequest());
    const seen: number[] = [];
    job.onProgress((pct) => seen.push(pct));

    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);

    expect(seen.length).toBeGreaterThan(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(100);
  });

  it('emits one partial ChangeSet midway', async () => {
    const job = executor().run(nudgeRequest());
    const partials: ChangeSet[] = [];
    job.onPartial((p) => partials.push(p));

    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    const full = await job.result;

    expect(partials).toHaveLength(1);
    expect(partials[0]!.groups.length).toBeLessThanOrEqual(full.groups.length);
    expect(partials[0]!.label).toContain('partial');
  });

  it('honours cancel() immediately, leaving the document untouched', async () => {
    const before = getDocument();
    const job = executor().run(nudgeRequest());

    await vi.advanceTimersByTimeAsync(500);
    job.cancel();

    expect(job.status()).toBe('cancelled');
    await expect(job.result).rejects.toBeInstanceOf(JobCancelledError);

    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    expect(job.status()).toBe('cancelled');
    expect(getDocument()).toBe(before);
  });

  it('emits nothing after cancellation', async () => {
    const job = executor().run(nudgeRequest());
    let progress = 0;
    let partials = 0;
    job.onProgress(() => (progress += 1));
    job.onPartial(() => (partials += 1));

    job.cancel();
    await expect(job.result).rejects.toBeInstanceOf(JobCancelledError);
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);

    expect(progress).toBe(0);
    expect(partials).toBe(0);
  });

  it('NEVER emits a command touching a locked block', async () => {
    const job = executor().run(nudgeRequest(['locked', 'b2']));
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    const cs = await job.result;

    expect(changeSetTouches(cs, ['locked', 'b2'])).toBe(false);
    expect(changeSetTouches(cs, ['b1'])).toBe(true);
  });

  it('implements the echo kind, respecting locks', async () => {
    const exec = executor();
    const job = exec.run({
      kind: 'echo',
      payload: { targetBlockId: 'b1', spreadId: 'spread_1', note: 'move this down' },
      scope: { spreadIds: ['spread_1'] },
    });
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    const cs = await job.result;

    expect(cs.label).toContain('move this down');
    expect(cs.groups).toHaveLength(2);

    const locked = exec.run({
      kind: 'echo',
      payload: { targetBlockId: 'b1', spreadId: 'spread_1', note: 'nope' },
      scope: { spreadIds: ['spread_1'], lockedBlockIds: ['b1'] },
    });
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    expect((await locked.result).groups).toHaveLength(0);
  });

  it('returns an empty ChangeSet for an unknown kind', async () => {
    const job = executor().run({ kind: 'wat', payload: {}, scope: { spreadIds: ['spread_1'] } });
    await vi.advanceTimersByTimeAsync(MOCK_MAX_LATENCY_MS);
    expect((await job.result).groups).toEqual([]);
  });
});

describe('applyChangeSet', () => {
  const twoGroups = (): ChangeSet => ({
    id: 'cs1',
    label: 'Two intents',
    groups: [
      {
        id: 'g-a',
        label: 'Move b1',
        commands: [
          {
            type: 'block/update',
            spreadId: 'spread_1',
            blockId: 'b1',
            patch: { frame: { x: 20, y: 100, w: 60, h: 40 } },
          },
        ],
      },
      {
        id: 'g-b',
        label: 'Widen b2',
        commands: [
          {
            type: 'block/update',
            spreadId: 'spread_1',
            blockId: 'b2',
            patch: { frame: { x: 100, y: 77, w: 90, h: 40 } },
          },
        ],
      },
    ],
  });

  const b = (id: string) => getDocument().spreads[0]!.blocks.find((x) => x.id === id)!;

  it('applies every group when none is named', () => {
    const r = applyChangeSet(twoGroups());
    expect(r.applied).toEqual(['g-a', 'g-b']);
    expect(b('b1').frame.y).toBe(100);
    expect(b('b2').frame.w).toBe(90);
  });

  it('applies only the accepted group', () => {
    applyChangeSet(twoGroups(), { acceptGroupIds: ['g-a'] });
    expect(b('b1').frame.y).toBe(100);
    expect(b('b2').frame.w).toBe(60); // rejected group did not land
  });

  it('round-trips: apply → undo restores the prior document exactly', () => {
    const before = JSON.parse(JSON.stringify(getDocument()));
    applyChangeSet(twoGroups());
    expect(getDocument()).not.toEqual(before);

    undo();
    expect(getDocument().spreads).toEqual(before.spreads);
  });

  it('is one undo step however many commands it carries', () => {
    applyChangeSet(twoGroups());
    undo();
    expect(b('b1').frame.y).toBe(31);
    expect(b('b2').frame.w).toBe(60);
    expect(canUndo()).toBe(true); // only the seeding commands are left
  });

  it('goes through the bus: every command is logged with the given source', () => {
    const before = getLog().length;
    applyChangeSet(twoGroups(), { source: 'diff-review' });
    const added = getLog().slice(before);

    expect(added).toHaveLength(2);
    expect(added.every((e) => e.source === 'diff-review')).toBe(true);
    expect(new Set(added.map((e) => e.groupId)).size).toBe(1);
  });

  it('does nothing when no group is accepted', () => {
    const before = getDocument();
    expect(applyChangeSet(twoGroups(), { acceptGroupIds: [] })).toEqual({
      applied: [],
      commandCount: 0,
    });
    expect(getDocument()).toBe(before);
  });
});

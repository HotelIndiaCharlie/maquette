/** Selection — SPEC.md §4.6. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSelectionForTests, selectOnly, selection } from './index';
import { __resetBusForTests, dispatch, undo } from '../commands/bus';
import type { Block } from '../model/types';

const aBlock = (id: string): Block => ({ id, type: 'body', frame: { x: 20, y: 20, w: 60, h: 40 } });

beforeEach(() => {
  __resetBusForTests();
  __resetSelectionForTests();
});

describe('selection', () => {
  it('starts empty', () => {
    expect(selection.get()).toEqual({ blockIds: [], spreadId: null });
  });

  it('sets, clears and notifies', () => {
    const cb = vi.fn();
    const off = selection.subscribe(cb);

    selection.set({ spreadId: 'spread_1', blockIds: ['a'] });
    expect(selection.get()).toEqual({ spreadId: 'spread_1', blockIds: ['a'] });
    expect(cb).toHaveBeenCalledTimes(1);

    selection.clear();
    expect(cb).toHaveBeenCalledTimes(2);
    off();
  });

  it('does not notify when nothing actually changed', () => {
    selection.set({ spreadId: 'spread_1', blockIds: ['a'] });
    const cb = vi.fn();
    const off = selection.subscribe(cb);
    selection.set({ spreadId: 'spread_1', blockIds: ['a'] });
    expect(cb).not.toHaveBeenCalled();
    off();
  });

  it('copies the ids, so a caller cannot mutate it from outside', () => {
    const ids = ['a'];
    selection.set({ spreadId: 'spread_1', blockIds: ids });
    ids.push('b');
    expect(selection.get().blockIds).toEqual(['a']);
  });

  it('drops a block that a command removed', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    selectOnly('spread_1', 'b1');

    dispatch({ type: 'block/remove', spreadId: 'spread_1', blockId: 'b1' });
    expect(selection.get().blockIds).toEqual([]);
  });

  it('keeps the rest of a multiple selection when one block goes', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b2') });
    selection.set({ spreadId: 'spread_1', blockIds: ['b1', 'b2'] });

    dispatch({ type: 'block/remove', spreadId: 'spread_1', blockId: 'b1' });
    expect(selection.get().blockIds).toEqual(['b2']);
  });

  it('survives an undo that brings the block back', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    selectOnly('spread_1', 'b1');
    dispatch({ type: 'block/remove', spreadId: 'spread_1', blockId: 'b1' });
    undo();
    // the block is back; the selection is not restored, but nothing is stale
    expect(selection.get().blockIds).toEqual([]);
  });
});

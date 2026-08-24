/** Bus + history — SPEC.md §4.3, §4.11. */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetBusForTests,
  canRedo,
  canUndo,
  dispatch,
  dispatchAs,
  getDocument,
  getLog,
  redo,
  replaceDocument,
  subscribeDoc,
  transactAs,
  undo,
} from './bus';
import { createSeedDocument } from '../model/seed';
import { KernelError } from '../model/reducers';
import type { Block } from '../model/types';

const frame = { x: 20, y: 20, w: 60, h: 40 };
const aBlock = (id: string): Block => ({ id, type: 'body', frame: { ...frame } });

const blocks = () => getDocument().spreads[0]!.blocks;

beforeEach(() => {
  __resetBusForTests();
});

describe('dispatch', () => {
  it('is the only door: the document changes only through it', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    expect(blocks()).toHaveLength(1);
  });

  it('validates before reducing', () => {
    expect(() =>
      dispatch({ type: 'block/add', spreadId: '', block: aBlock('bad') }),
    ).toThrow(KernelError);
    expect(blocks()).toHaveLength(0);
  });

  it('maintains updatedAt', () => {
    const before = getDocument().updatedAt;
    dispatch({ type: 'spread/add' });
    expect(getDocument().updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('notifies subscribers exactly once per command', () => {
    let calls = 0;
    const off = subscribeDoc(() => {
      calls += 1;
    });
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    dispatch({ type: 'block/update', spreadId: 'spread_1', blockId: 'b1', patch: { sizePt: 10 } });
    off();
    dispatch({ type: 'spread/add' });
    expect(calls).toBe(2);
  });
});

describe('log', () => {
  it('records the dispatching plugin id as source', () => {
    dispatchAs('tools-basic', { type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    const entry = getLog().at(-1)!;
    expect(entry.source).toBe('tools-basic');
    expect(entry.cmd.type).toBe('block/add');
    expect(entry.ts).toBeTypeOf('number');
  });

  it('logs a no-op command as intent but takes no history step', () => {
    dispatch({ type: 'block/remove', spreadId: 'spread_1', blockId: 'ghost' });
    expect(getLog()).toHaveLength(1);
    expect(canUndo()).toBe(false);
  });

  it('one completed gesture is one log entry', () => {
    dispatchAs('tools-basic', { type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    expect(getLog().filter((e) => e.source === 'tools-basic')).toHaveLength(1);
  });
});

describe('undo / redo', () => {
  it('reverses one command per step', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    dispatch({
      type: 'block/update',
      spreadId: 'spread_1',
      blockId: 'b1',
      patch: { frame: { ...frame, x: 100 } },
    });
    expect(blocks()[0]!.frame.x).toBe(100);

    undo();
    expect(blocks()[0]!.frame.x).toBe(20); // the move reverts

    undo();
    expect(blocks()).toHaveLength(0); // the block goes

    expect(canUndo()).toBe(false);
  });

  it('redoes what it undid', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    undo();
    expect(canRedo()).toBe(true);
    redo();
    expect(blocks()).toHaveLength(1);
  });

  it('drops the redo stack once a new command lands', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    undo();
    dispatch({ type: 'spread/add' });
    expect(canRedo()).toBe(false);
  });

  it('does nothing at the ends of the stack', () => {
    expect(() => undo()).not.toThrow();
    expect(() => redo()).not.toThrow();
  });
});

describe('transact', () => {
  it('collapses several commands into one undo step', () => {
    transactAs('sketch', 'Sketch three frames', () => {
      dispatchAs('sketch', { type: 'block/add', spreadId: 'spread_1', block: aBlock('s1') });
      dispatchAs('sketch', { type: 'block/add', spreadId: 'spread_1', block: aBlock('s2') });
      dispatchAs('sketch', { type: 'block/add', spreadId: 'spread_1', block: aBlock('s3') });
    });
    expect(blocks()).toHaveLength(3);

    undo();
    expect(blocks()).toHaveLength(0);
  });

  it('stamps every entry in the group with one group id and label', () => {
    transactAs('adhoc', 'Leading +0.5', () => {
      dispatchAs('adhoc', { type: 'block/add', spreadId: 'spread_1', block: aBlock('a') });
      dispatchAs('adhoc', { type: 'block/add', spreadId: 'spread_1', block: aBlock('b') });
    });
    const groupIds = new Set(getLog().map((e) => e.groupId));
    expect(groupIds.size).toBe(1);
    expect(getLog()[0]!.label).toBe('Leading +0.5');
  });

  it('rolls the whole group back when one command throws', () => {
    expect(() =>
      transactAs('sketch', 'Half a gesture', () => {
        dispatchAs('sketch', { type: 'block/add', spreadId: 'spread_1', block: aBlock('ok') });
        dispatchAs('sketch', { type: 'block/add', spreadId: 'nope', block: aBlock('boom') });
      }),
    ).toThrow(KernelError);
    expect(blocks()).toHaveLength(0);
    expect(canUndo()).toBe(false);
  });

  it('takes no history step when nothing actually changed', () => {
    transactAs('probe', 'Nothing', () => {
      dispatchAs('probe', { type: 'block/remove', spreadId: 'spread_1', blockId: 'ghost' });
    });
    expect(canUndo()).toBe(false);
  });
});

describe('replaceDocument', () => {
  it('is not an edit: it clears history and log', () => {
    dispatch({ type: 'block/add', spreadId: 'spread_1', block: aBlock('b1') });
    replaceDocument(createSeedDocument('Imported'));
    expect(getDocument().title).toBe('Imported');
    expect(canUndo()).toBe(false);
    expect(getLog()).toHaveLength(0);
  });
});

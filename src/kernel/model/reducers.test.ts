/** One test per command — SPEC.md §4.11. */
import { describe, expect, it } from 'vitest';
import { KernelError, normalizeFrame, reduce, type ReduceContext } from './reducers';
import { createSeedDocument } from './seed';
import { DEFAULT_PAGE, MIN_BLOCK_H_MM, MIN_BLOCK_W_MM, type Block, type DocumentV1 } from './types';

const ctx: ReduceContext = { nextId: () => 'spread_new' };

function docWithBlock(frame = { x: 10, y: 10, w: 60, h: 40 }): DocumentV1 {
  const doc = createSeedDocument();
  return reduce(
    doc,
    { type: 'block/add', spreadId: 'spread_1', block: { id: 'b1', type: 'body', frame } },
    ctx,
  );
}

const first = (doc: DocumentV1) => doc.spreads[0]!;
const block = (doc: DocumentV1, id = 'b1'): Block => first(doc).blocks.find((b) => b.id === id)!;

describe('normalizeFrame', () => {
  it('enforces the 14 × 8 mm minimum', () => {
    const r = normalizeFrame({ x: 0, y: 0, w: 2, h: 1 }, DEFAULT_PAGE);
    expect(r.w).toBe(MIN_BLOCK_W_MM);
    expect(r.h).toBe(MIN_BLOCK_H_MM);
  });

  it('clamps to spread bounds (2 pages wide, 1 page tall)', () => {
    const r = normalizeFrame({ x: 1000, y: 1000, w: 60, h: 40 }, DEFAULT_PAGE);
    expect(r.x).toBe(420 - 60);
    expect(r.y).toBe(280 - 40);
  });

  it('clamps negative origins to zero', () => {
    expect(normalizeFrame({ x: -50, y: -20, w: 60, h: 40 }, DEFAULT_PAGE)).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it('never lets a frame exceed the spread', () => {
    const r = normalizeFrame({ x: 0, y: 0, w: 9999, h: 9999 }, DEFAULT_PAGE);
    expect(r.w).toBe(420);
    expect(r.h).toBe(280);
  });
});

describe('block/add', () => {
  it('adds the block to the named spread', () => {
    const doc = docWithBlock();
    expect(first(doc).blocks).toHaveLength(1);
    expect(block(doc).type).toBe('body');
  });

  it('normalises the frame on the way in', () => {
    const doc = reduce(
      createSeedDocument(),
      {
        type: 'block/add',
        spreadId: 'spread_1',
        block: { id: 'tiny', type: 'body', frame: { x: -5, y: -5, w: 1, h: 1 } },
      },
      ctx,
    );
    expect(block(doc, 'tiny').frame).toEqual({ x: 0, y: 0, w: 14, h: 8 });
  });

  it('rejects an unknown spread', () => {
    expect(() =>
      reduce(
        createSeedDocument(),
        {
          type: 'block/add',
          spreadId: 'nope',
          block: { id: 'x', type: 'body', frame: { x: 0, y: 0, w: 20, h: 20 } },
        },
        ctx,
      ),
    ).toThrow(KernelError);
  });

  it('rejects a duplicate block id', () => {
    const doc = docWithBlock();
    expect(() =>
      reduce(
        doc,
        {
          type: 'block/add',
          spreadId: 'spread_1',
          block: { id: 'b1', type: 'body', frame: { x: 0, y: 0, w: 20, h: 20 } },
        },
        ctx,
      ),
    ).toThrow(KernelError);
  });

  it('does not mutate the input document', () => {
    const before = createSeedDocument();
    const snapshot = JSON.stringify(before);
    docWithBlock();
    reduce(
      before,
      {
        type: 'block/add',
        spreadId: 'spread_1',
        block: { id: 'z', type: 'body', frame: { x: 0, y: 0, w: 20, h: 20 } },
      },
      ctx,
    );
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('block/update', () => {
  it('merges the patch', () => {
    const doc = reduce(
      docWithBlock(),
      { type: 'block/update', spreadId: 'spread_1', blockId: 'b1', patch: { sizePt: 11 } },
      ctx,
    );
    expect(block(doc).sizePt).toBe(11);
  });

  it('clamps a patched frame', () => {
    const doc = reduce(
      docWithBlock(),
      {
        type: 'block/update',
        spreadId: 'spread_1',
        blockId: 'b1',
        patch: { frame: { x: 999, y: 0, w: 60, h: 40 } },
      },
      ctx,
    );
    expect(block(doc).frame.x).toBe(360);
  });

  it('ignores an attempt to change the id', () => {
    const doc = reduce(
      docWithBlock(),
      {
        type: 'block/update',
        spreadId: 'spread_1',
        blockId: 'b1',
        patch: { id: 'hijacked' } as Partial<Block>,
      },
      ctx,
    );
    expect(block(doc).id).toBe('b1');
  });

  it('is a no-op (same reference) when the block is gone', () => {
    const doc = docWithBlock();
    const next = reduce(
      doc,
      { type: 'block/update', spreadId: 'spread_1', blockId: 'ghost', patch: { sizePt: 9 } },
      ctx,
    );
    expect(next).toBe(doc);
  });
});

describe('block/remove', () => {
  it('removes the block', () => {
    const doc = reduce(
      docWithBlock(),
      { type: 'block/remove', spreadId: 'spread_1', blockId: 'b1' },
      ctx,
    );
    expect(first(doc).blocks).toHaveLength(0);
  });

  it('is a no-op when it is already gone', () => {
    const doc = docWithBlock();
    expect(reduce(doc, { type: 'block/remove', spreadId: 'spread_1', blockId: 'x' }, ctx)).toBe(doc);
  });
});

describe('spread/add', () => {
  it('appends an empty spread with an injected id', () => {
    const doc = reduce(createSeedDocument(), { type: 'spread/add' }, ctx);
    expect(doc.spreads).toHaveLength(4);
    expect(doc.spreads[3]).toEqual({ id: 'spread_new', cols: 3, blocks: [] });
  });

  it('inherits the previous spread column count', () => {
    let doc = reduce(
      createSeedDocument(),
      { type: 'spread/update', spreadId: 'spread_3', patch: { cols: 6 } },
      ctx,
    );
    doc = reduce(doc, { type: 'spread/add' }, ctx);
    expect(doc.spreads[3]!.cols).toBe(6);
  });
});

describe('spread/update', () => {
  it('sets the column count', () => {
    const doc = reduce(
      createSeedDocument(),
      { type: 'spread/update', spreadId: 'spread_2', patch: { cols: 4 } },
      ctx,
    );
    expect(doc.spreads[1]!.cols).toBe(4);
  });

  it('clamps the column count into range', () => {
    const doc = reduce(
      createSeedDocument(),
      { type: 'spread/update', spreadId: 'spread_2', patch: { cols: 99 } },
      ctx,
    );
    expect(doc.spreads[1]!.cols).toBe(12);
  });
});

describe('doc/update', () => {
  it('sets the title', () => {
    const doc = reduce(createSeedDocument(), { type: 'doc/update', patch: { title: 'Issue 4' } }, ctx);
    expect(doc.title).toBe('Issue 4');
  });

  it('re-contains every frame when the page shrinks', () => {
    const doc = reduce(
      docWithBlock({ x: 300, y: 200, w: 100, h: 60 }),
      { type: 'doc/update', patch: { page: { ...DEFAULT_PAGE, wMm: 120, hMm: 150 } } },
      ctx,
    );
    const f = block(doc).frame;
    expect(f.x + f.w).toBeLessThanOrEqual(240);
    expect(f.y + f.h).toBeLessThanOrEqual(150);
  });
});

/** Text seam — SPEC.md §4.10. */
import { describe, expect, it } from 'vitest';
import { greek } from './greek';
import { AVG_CHAR_WIDTH_RATIO, measure, wordsToFill } from './measure';

describe('greek', () => {
  it('is deterministic', () => {
    expect(greek(12)).toBe(greek(12));
  });

  it('produces the requested number of words', () => {
    expect(greek(5).replace('.', '').split(' ')).toHaveLength(5);
  });

  it('is empty for zero or negative', () => {
    expect(greek(0)).toBe('');
    expect(greek(-3)).toBe('');
  });

  it('grows by appending, so a longer frame keeps the same opening', () => {
    expect(greek(20).startsWith(greek(5).slice(0, -1))).toBe(true);
  });
});

describe('measure — a stated approximation', () => {
  const attrs = { sizePt: 9.5, leadingPt: 12, align: 'justify' as const };

  it('uses avg char width = 0.5 × sizePt', () => {
    expect(AVG_CHAR_WIDTH_RATIO).toBe(0.5);
    // 9.5pt → 3.3516mm per em → 1.6758mm per char; 100mm ⇒ 59 chars
    expect(measure('x'.repeat(59), 100, attrs).lines).toBe(1);
    expect(measure('x'.repeat(60), 100, attrs).lines).toBe(2);
  });

  it('reports no overflow when no height is known', () => {
    expect(measure('x'.repeat(10_000), 60, attrs).overflow).toBe(false);
  });

  it('reports overflow against a known height', () => {
    const short = measure('x'.repeat(400), 60, { ...attrs, heightMm: 100 });
    const tall = measure('x'.repeat(400), 60, { ...attrs, heightMm: 5 });
    expect(short.overflow).toBe(false);
    expect(tall.overflow).toBe(true);
  });

  it('reports fill as a fraction of the frame height', () => {
    const m = measure('x'.repeat(200), 60, { ...attrs, heightMm: 100 });
    expect(m.fill).toBeCloseTo(m.usedHeightMm / 100, 6);
  });

  it('measures empty text as zero lines', () => {
    expect(measure('', 60, attrs)).toMatchObject({ lines: 0, overflow: false });
  });

  it('gets tighter as the type gets bigger', () => {
    const small = measure('x'.repeat(500), 80, attrs).lines;
    const big = measure('x'.repeat(500), 80, { ...attrs, sizePt: 38 }).lines;
    expect(big).toBeGreaterThan(small);
  });
});

describe('wordsToFill', () => {
  it('asks for more words as the frame grows', () => {
    const attrs = { sizePt: 9.5, leadingPt: 12, align: 'justify' as const };
    expect(wordsToFill(120, 200, attrs)).toBeGreaterThan(wordsToFill(60, 100, attrs));
  });

  it('always asks for at least one word', () => {
    expect(wordsToFill(1, 1, { sizePt: 38, leadingPt: 40, align: 'left' })).toBeGreaterThanOrEqual(1);
  });
});

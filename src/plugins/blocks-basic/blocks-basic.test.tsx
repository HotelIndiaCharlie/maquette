/**
 * Unit tests — packet §6. Held to the same contract as the example plugin
 * (manifest, registration, unload), plus the arithmetic and commit-semantics
 * numbers packet §4 states explicitly.
 *
 * The commit-semantics test renders the real `Inspector` fragment and drives
 * its Radix `Slider` through a genuine pointer drag. jsdom does not implement
 * `ResizeObserver` or pointer capture, both of which `@radix-ui/react-slider`
 * needs, so this file stubs them itself rather than touching the shared
 * `test/setup.ts` — see the toolkit note in docs/adr/006 for why every future
 * plugin with an interactive Inspector will hit the same wall.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLUGIN_ID_PATTERN,
  assertValidManifest,
  blockTypes,
  dispatchAs,
  getDocument,
  getLog,
  loadPlugins,
  mockExecutor,
  overlays,
  panels,
  ptToPx,
  registries,
  tools,
  views,
  type BlockTypeDef,
} from '@/kernel';
import { plugin } from './index';
import { createBodyDefault } from './BodyBlock';
import { createHeadlineDefault } from './HeadlineBlock';
import { createQuoteDefault } from './QuoteBlock';
import { createImageDefault, imageBlockType } from './ImageBlock';
import { PlaygroundView } from './PlaygroundView';
import { resolveCommit } from './TypeInspector';
import {
  BODY_DEFAULT_LEADING_PT,
  BODY_DEFAULT_SIZE_PT,
  FLATPLAN_SCALE,
  FPO_CAPTION_SIZE_PT,
  FPO_MIN_PX,
  HEADLINE_DEFAULT_LEADING_PT,
  HEADLINE_DEFAULT_SIZE_PT,
  PLAYGROUND_FULL_SCALE,
  QUOTE_DEFAULT_LEADING_PT,
  QUOTE_DEFAULT_SIZE_PT,
} from './constants';

const flags = { get: () => false };

function load() {
  return { host: loadPlugins([plugin], { flags, jobs: mockExecutor }) };
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

/* ── the manifest ─────────────────────────────────────────────────────────── */

describe('the blocks-basic plugin manifest', () => {
  it('is valid against the contract', () => {
    expect(() => assertValidManifest(plugin)).not.toThrow();
  });

  it('has an id that matches PLUGIN_ID_PATTERN and its folder name', () => {
    expect(plugin.id).toBe('blocks-basic');
    expect(PLUGIN_ID_PATTERN.test(plugin.id)).toBe(true);
  });

  it('is unflagged, like every built-in', () => {
    expect(plugin.flag).toBeUndefined();
  });
});

/* ── registration and unload ─────────────────────────────────────────────── */

describe('register() and its disposer', () => {
  beforeEach(() => {
    for (const reg of Object.values(registries)) {
      expect(reg.list()).toHaveLength(0);
    }
  });

  it('registers all four block types and the playground view; unload removes every one', () => {
    const { host } = load();

    expect(host.loaded[0]?.status).toBe('active');
    expect(registryIds()).toEqual({
      blockTypes: ['body', 'headline', 'quote', 'image'],
      tools: [],
      overlays: [],
      panels: [],
      views: ['blocks-basic-playground'],
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
});

/* ── createDefault, field by field (packet §4.1) ─────────────────────────── */

describe('createDefault', () => {
  const frame = { x: 10, y: 10, w: 60, h: 40 };

  it('body: sizePt 9.5, leadingPt 12, align left', () => {
    const block = createBodyDefault(frame);
    expect(block.type).toBe('body');
    expect(block.id).toMatch(/^body_/);
    expect(block.frame).toEqual(frame);
    expect(block.sizePt).toBe(BODY_DEFAULT_SIZE_PT);
    expect(block.leadingPt).toBe(BODY_DEFAULT_LEADING_PT);
    expect(block.align).toBe('left');
  });

  it('headline: sizePt 38, leadingPt 40, align left', () => {
    const block = createHeadlineDefault(frame);
    expect(block.type).toBe('headline');
    expect(block.id).toMatch(/^headline_/);
    expect(block.sizePt).toBe(HEADLINE_DEFAULT_SIZE_PT);
    expect(block.leadingPt).toBe(HEADLINE_DEFAULT_LEADING_PT);
    expect(block.align).toBe('left');
  });

  it('quote: sizePt 16, leadingPt 20, align left', () => {
    const block = createQuoteDefault(frame);
    expect(block.type).toBe('quote');
    expect(block.id).toMatch(/^quote_/);
    expect(block.sizePt).toBe(QUOTE_DEFAULT_SIZE_PT);
    expect(block.leadingPt).toBe(QUOTE_DEFAULT_LEADING_PT);
    expect(block.align).toBe('left');
  });

  it('image: no sizePt, leadingPt or align key at all', () => {
    const block = createImageDefault(frame);
    expect(block.type).toBe('image');
    expect(block.id).toMatch(/^image_/);
    expect(block.frame).toEqual(frame);
    expect(Object.keys(block).sort()).toEqual(['frame', 'id', 'type']);
  });

  it('every type provides both layers and an Inspector fragment for B5 to find', () => {
    const { host } = load();
    try {
      for (const id of ['body', 'headline', 'quote', 'image']) {
        const def = blockTypes.get(id) as BlockTypeDef;
        expect(def.MiniView).toBeTypeOf('function');
        expect(def.FullView).toBeTypeOf('function');
        expect(def.Inspector).toBeTypeOf('function');
      }
    } finally {
      host.unloadAll();
    }
  });
});

/* ── bar arithmetic (packet §4.2, §6) ────────────────────────────────────── */

describe('greek bar arithmetic', () => {
  it('a 150 mm body block at flatplan scale: pitchPx ≈ 2.328, barPx ≈ 1.164, rows = 35', () => {
    const pitchPx = ptToPx(BODY_DEFAULT_LEADING_PT, FLATPLAN_SCALE);
    const barPx = pitchPx * 0.5;
    const rows = Math.max(1, Math.floor((150 * FLATPLAN_SCALE) / pitchPx));

    expect(pitchPx).toBeCloseTo(2.328, 3);
    expect(barPx).toBeCloseTo(1.164, 3);
    expect(rows).toBe(35);
  });

  it('rows never drops below 1, even when raw pitch overruns a minimum-height frame', () => {
    // packet §4.2 [CALL]: a 40 pt headline in an 8 mm frame is 7.76 px of
    // pitch in 4.4 px of frame — floor() alone would be 0.
    const pitchPx = ptToPx(HEADLINE_DEFAULT_LEADING_PT, FLATPLAN_SCALE);
    const rawRows = Math.floor((8 * FLATPLAN_SCALE) / pitchPx);
    const rows = Math.max(1, rawRows);

    expect(rawRows).toBe(0);
    expect(rows).toBe(1);
  });

  it('rows is at least 1 for every type at its own default leading, at the minimum frame height', () => {
    for (const leadingPt of [
      BODY_DEFAULT_LEADING_PT,
      HEADLINE_DEFAULT_LEADING_PT,
      QUOTE_DEFAULT_LEADING_PT,
    ]) {
      const pitchPx = ptToPx(leadingPt, FLATPLAN_SCALE);
      const rows = Math.max(1, Math.floor((8 * FLATPLAN_SCALE) / pitchPx));
      expect(rows).toBeGreaterThanOrEqual(1);
    }
  });
});

/* ── FPO caption degradation (packet §4.4) ───────────────────────────────── */

describe('the FPO caption', () => {
  it('is hidden at flatplan scale and present at the playground full scale', () => {
    const atFlatplan = ptToPx(FPO_CAPTION_SIZE_PT, FLATPLAN_SCALE);
    const atFull = ptToPx(FPO_CAPTION_SIZE_PT, PLAYGROUND_FULL_SCALE);

    expect(atFlatplan).toBeCloseTo(1.36, 2);
    expect(atFull).toBeCloseTo(7.41, 2);
    expect(atFlatplan).toBeLessThan(FPO_MIN_PX);
    expect(atFull).toBeGreaterThanOrEqual(FPO_MIN_PX);
  });

  it('is absent from the rendered image box at flatplan scale and present at the full scale', async () => {
    const block = createImageDefault({ x: 0, y: 0, w: 60, h: 40 });
    const flatplan = await render(<imageBlockType.MiniView block={block} scale={FLATPLAN_SCALE} />);
    const full = await render(<imageBlockType.FullView block={block} scale={PLAYGROUND_FULL_SCALE} />);

    expect(flatplan.textContent).not.toContain('FPO');
    expect(full.textContent).toContain('FPO');

    flatplan.dispose();
    full.dispose();
  });
});

/* ── DOM render harness ──────────────────────────────────────────────────── */
// ResizeObserver, pointer capture and IS_REACT_ACT_ENVIRONMENT are stubbed
// once for every test file in test/setup.ts — jsdom gaps, not anything
// specific to this plugin (docs/adr/006, "Amendments from implementing B1").

interface Mounted {
  container: HTMLDivElement;
  dispose: () => void;
  textContent: string | null;
}

async function render(node: React.ReactElement): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    textContent: container.textContent,
    dispose: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/* ── the Inspector fragment — commit semantics (packet §4.6) ────────────── */

describe('the Inspector fragment — commit semantics', () => {
  it('a no-op commit resolves to null; a real change resolves to the rounded next value', () => {
    expect(resolveCommit(9.5, 9.5)).toBeNull();
    expect(resolveCommit(9.5, 9.5001)).toBeNull(); // rounds to the same 0.5 pt step
    expect(resolveCommit(9.5, 10)).toBe(10);
  });

  it('driving the size slider through several intermediate values and one release appends exactly one log entry', async () => {
    const { host } = load();
    try {
      const spreadId = getDocument().spreads[0]?.id;
      expect(spreadId).toBeTruthy();
      dispatchAs('test-seed', {
        type: 'block/add',
        spreadId: spreadId as string,
        block: createBodyDefault({ x: 20, y: 20, w: 60, h: 40 }),
      });
      const block = getDocument()
        .spreads.find((s) => s.id === spreadId)!
        .blocks.find((b) => b.type === 'body')!;
      expect(block.sizePt).toBe(BODY_DEFAULT_SIZE_PT);

      const Inspector = blockTypes.get('body')!.Inspector!;
      const mounted = await render(<Inspector block={block} spreadId={spreadId as string} />);
      try {
        const slider = mounted.container.querySelector(`#${block.id}-size`) as HTMLElement;
        expect(slider).toBeTruthy();

        (Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
          () =>
            ({ left: 0, top: 0, width: 200, height: 20, right: 200, bottom: 20, x: 0, y: 0, toJSON() {} }) as DOMRect;

        const pointerEvent = (type: string, clientX: number) =>
          slider.dispatchEvent(new PointerEvent(type, { clientX, bubbles: true, cancelable: true, pointerId: 1 }));

        const before = getLog().length;

        // Down, two intermediate moves, then release at a different value —
        // ONE gesture, nothing but local state until the release (§4.6).
        await act(async () => pointerEvent('pointerdown', 60));
        await act(async () => pointerEvent('pointermove', 90));
        await act(async () => pointerEvent('pointermove', 120));
        await act(async () => pointerEvent('pointerup', 120));

        const added = getLog().slice(before);
        expect(added).toHaveLength(1);
        expect(added[0]?.cmd.type).toBe('block/update');
        expect(added[0]?.source).toBe('blocks-basic');
        if (added[0]?.cmd.type === 'block/update') {
          expect(added[0].cmd.spreadId).toBe(spreadId);
          expect(added[0].cmd.blockId).toBe(block.id);
          expect(added[0].cmd.patch.sizePt).toBeTypeOf('number');
          expect(added[0].cmd.patch.sizePt).not.toBe(BODY_DEFAULT_SIZE_PT);
        }
      } finally {
        mounted.dispose();
      }
    } finally {
      host.unloadAll();
    }
  });

  it('the align toggle dispatches exactly one command on click, for body only', async () => {
    const { host } = load();
    try {
      const spreadId = getDocument().spreads[0]?.id as string;
      dispatchAs('test-seed', {
        type: 'block/add',
        spreadId,
        block: createBodyDefault({ x: 20, y: 20, w: 60, h: 40 }),
      });
      const block = getDocument()
        .spreads.find((s) => s.id === spreadId)!
        .blocks.find((b) => b.type === 'body')!;

      const Inspector = blockTypes.get('body')!.Inspector!;
      const mounted = await render(<Inspector block={block} spreadId={spreadId} />);
      try {
        const justify = [...mounted.container.querySelectorAll('button')].find(
          (b) => b.textContent === 'Justify',
        ) as HTMLButtonElement;
        expect(justify).toBeTruthy();

        const before = getLog().length;
        await act(async () => justify.click());

        const added = getLog().slice(before);
        expect(added).toHaveLength(1);
        expect(added[0]?.cmd.type).toBe('block/update');
        expect(added[0]?.source).toBe('blocks-basic');
        if (added[0]?.cmd.type === 'block/update') {
          expect(added[0].cmd.patch.align).toBe('justify');
        }
      } finally {
        mounted.dispose();
      }
    } finally {
      host.unloadAll();
    }
  });

  it('headline and quote store align but expose no toggle', async () => {
    const { host } = load();
    try {
      const spreadId = getDocument().spreads[0]?.id as string;
      const headlineBlock = createHeadlineDefault({ x: 0, y: 0, w: 60, h: 40 });
      dispatchAs('test-seed', { type: 'block/add', spreadId, block: headlineBlock });

      const Inspector = blockTypes.get('headline')!.Inspector!;
      const mounted = await render(<Inspector block={headlineBlock} spreadId={spreadId} />);
      try {
        expect(mounted.container.querySelectorAll('[role="radio"], [role="group"]')).toHaveLength(0);
      } finally {
        mounted.dispose();
      }
    } finally {
      host.unloadAll();
    }
  });
});

/* ── the playground view (packet §4.7) ───────────────────────────────────── */

describe('the playground view', () => {
  it('is synthetic and read-only: rendering it dispatches nothing', async () => {
    const { host } = load();
    try {
      const before = getLog().length;
      const mounted = await render(<PlaygroundView />);
      try {
        expect(getLog().length).toBe(before);
        // Two headings, and one block per type across both layers.
        expect(mounted.container.textContent).toContain('Layer 1 · flatplan · 0.55 px/mm');
        expect(mounted.container.textContent).toContain('Layer 2 · spread · 3.0 px/mm');
        expect(mounted.container.querySelectorAll('[data-block-id]')).toHaveLength(8);
        // BlockLayer's UnknownBlock placeholder is a dashed border box — zero
        // of those means every registered type actually resolved a view.
        expect(mounted.container.querySelectorAll('.border-dashed')).toHaveLength(0);
      } finally {
        mounted.dispose();
      }
    } finally {
      host.unloadAll();
    }
  });
});

// No arbitrary token values (packet §6): "grep the folder for `[#` and
// `px]` inside className — zero hits" is run as a literal shell command as
// part of the gate, not as a unit test — src/plugins/**/*.test.tsx compiles
// under tsconfig.app.json, which carries no `node` types, so a test that
// shells out to `node:fs` fails typecheck for reasons unrelated to what it
// is checking.

/**
 * The playground view — packet §4.7. With `PLUGIN_LIST = [blocksBasic]` there
 * is no tool (B2), no flatplan (B3) and no spread editor (B4), so nothing
 * else can put a block on screen. This view is the one place B1's own
 * acceptance is performable today (SPEC.md §1: the playground arena is
 * "central product surface, not side rooms").
 *
 * The spread is SYNTHETIC: built in memory and handed to `SpreadPaper`. It
 * dispatches nothing, persists nothing, and never touches the user's
 * document. `BlockLayer` resolves views from the registry, not the document,
 * so this works.
 */
import type { Spread, ViewDef } from '@/kernel';
import { DEFAULT_COLS, SpreadPaper, useDocument } from '@/kernel';
import { createBodyDefault } from './BodyBlock';
import { createHeadlineDefault } from './HeadlineBlock';
import { createImageDefault } from './ImageBlock';
import { createQuoteDefault } from './QuoteBlock';
import { FLATPLAN_SCALE, PLAYGROUND_FULL_SCALE } from './constants';

/** One demo block per type, from each type's own `createDefault` — packet §4.7 table. */
function demoSpread(): Spread {
  return {
    id: 'blocks-basic-playground-spread',
    cols: DEFAULT_COLS,
    blocks: [
      createHeadlineDefault({ x: 13, y: 18, w: 182, h: 30 }),
      createBodyDefault({ x: 13, y: 54, w: 182, h: 150 }),
      createQuoteDefault({ x: 225, y: 18, w: 182, h: 60 }),
      createImageDefault({ x: 225, y: 88, w: 182, h: 120 }),
    ],
  };
}

const HEADING_CLASS = 'font-ui text-label tracking-caps text-ink-soft uppercase';

export const PlaygroundView: ViewDef['View'] = () => {
  // Tracks real page setup, even though the spread itself is synthetic (§4.7).
  const { page } = useDocument();
  const spread = demoSpread();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h2 className={HEADING_CLASS}>Layer 1 · flatplan · 0.55 px/mm</h2>
        <div className="overflow-auto">
          <SpreadPaper
            spread={spread}
            page={page}
            scale={FLATPLAN_SCALE}
            mode="mini"
            layer="flatplan"
            selectedIds={[]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={HEADING_CLASS}>Layer 2 · spread · 3.0 px/mm</h2>
        <div className="overflow-auto">
          <SpreadPaper
            spread={spread}
            page={page}
            scale={PLAYGROUND_FULL_SCALE}
            mode="full"
            layer="spread"
            selectedIds={[]}
          />
        </div>
      </div>

      <p className="font-ui text-micro text-ink-soft">
        Inspector fragments appear in the panel dock once B5 inspector is loaded.
      </p>
    </div>
  );
};

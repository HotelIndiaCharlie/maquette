---
packet-template-version: 0.2
plugin: blocks-basic
lot: 1 (B1)
source: SPEC.md §7 B1, resolved through docs/plugin-authoring.md
kernel-api-version: 1
status: ready to implement — no BLOCKED items
---

# Work packet — `blocks-basic`

Four block types: **body · headline · quote · image**. Each with a greeked Layer-1
`MiniView`, a typographic Layer-2 `FullView`, and an Inspector fragment. Plus one
playground view, so the plugin is testable before B2/B3/B4 exist (see §4.7).

Everything below is decided. **Nothing here needs your judgement.** Where a number
looks arbitrary it was settled in interview and the rationale is recorded; where SPEC.md
contradicts itself, §4.10 records the conflict and the resolution. Two small calls I made
rather than escalating are flagged **[CALL]** — reverse either freely.

---

## 1. Manifest

| Field | Value |
|---|---|
| `id` | `blocks-basic` |
| Folder | `src/plugins/blocks-basic/` |
| `name` | `Basic blocks` |
| `version` | `0.1.0` |
| `flag` | **none** — built-ins are unflagged |
| Load-list line | `src/shell/plugins.ts`: `import { plugin as blocksBasic } from '@/plugins/blocks-basic';` + `blocksBasic,` in `PLUGIN_LIST` |

Scaffold with `pnpm new:plugin blocks-basic`, then delete what you do not need — the
scaffold registers all five registries; B1 uses two.

| File | Holds |
|---|---|
| `index.ts` | manifest, `register(ctx)`, the four `blockTypes` registrations + one `views` registration |
| `constants.ts` | every number in §4 as named exports, so tests assert against the same values the views use |
| `BodyBlock.tsx` | `bodyBlockType: BlockTypeDef` — MiniView, FullView, Inspector, createDefault |
| `HeadlineBlock.tsx` | `headlineBlockType` |
| `QuoteBlock.tsx` | `quoteBlockType` |
| `ImageBlock.tsx` | `imageBlockType` |
| `GreekBars.tsx` | the shared MiniView bar renderer (§4.2), parameterised by tone |
| `TypeInspector.tsx` | the shared size/leading slider pair + optional align toggle (§4.6) |
| `PlaygroundView.tsx` | the `/playground/blocks-basic` view (§4.7) |
| `blocks-basic.test.ts` | unit tests (§6) |

---

## 2. Consumes

| Kernel export | Used for |
|---|---|
| `BlockTypeDef` | the four registrations (type only) |
| `ViewDef` | the playground registration (type only) |
| `Block`, `Rect`, `Spread`, `PageSetup` | model types (type only) |
| `MaquettePlugin`, `PluginContext`, `Dispose` | manifest and `register` (type only) |
| `disposeAll` | composing the five disposers |
| `newId` | block ids in `createDefault` |
| `ptToPx` | **every** pt→px conversion: type size, leading, bar pitch, FPO caption |
| `greek` | body and quote filler text |
| `wordsToFill` | how many greeked words a body frame takes |
| `DEFAULT_PAGE` | the playground's synthetic page |
| `SpreadPaper` | the playground's paper, both scales |
| `useDocument` | the playground reads `doc.page` so it tracks page setup |
| `MIN_BLOCK_W_MM`, `MIN_BLOCK_H_MM` | asserting the demo frames are legal |
| `Slider` (`@/components/ui/slider`) | size and leading controls |
| `ToggleGroup`, `ToggleGroupItem` (`@/components/ui/toggle-group`) | the body align toggle |
| `Label` (`@/components/ui/label`) | control labels |

**`ctx.bus.dispatch`** — one `block/update` per committed Inspector gesture (§4.6).
**`ctx.bus.transact`** — **not used.** Every B1 gesture is exactly one command.

**Other plugins' data read:** none.
**Kernel APIs needed that do not exist:** none. **No BLOCKED items in this packet.**

Explicitly *not* consumed, so nobody reaches for them: `ctx.storage` (keyspace is none),
`ctx.jobs`, `ctx.selection`, `ctx.viewport`, `ctx.flags`, `measure`, `FidelityBadge`
(§4.8), `snap*` (B2 owns snapping), `activeTool`/`forwardPointer` (B2 owns tools).

---

## 3. Registers

| Registry | id | Notes |
|---|---|---|
| `blockTypes` | `body` | label `Body` |
| `blockTypes` | `headline` | label `Headline` |
| `blockTypes` | `quote` | label `Quote` |
| `blockTypes` | `image` | label `Image` |
| `tools` | **none** | B2 `tools-basic` owns every tool |
| `overlays` | **none** | B4 `spread-editor` owns every overlay |
| `panels` | **none** | B5 `inspector` owns the dock panel; B1 owns only the *fragments* it hosts |
| `views` | `blocks-basic-playground` | route `/playground/blocks-basic` — see §4.7 |

Registry ids are global. `body` / `headline` / `quote` / `image` are also the values
stored in `Block.type`, so they are part of the document format from here on.

---

## 4. Behavior

### 4.0 Two scales, and the constants file

Every view receives `scale` in **px per mm**. Two scales matter:

| Surface | scale | Source |
|---|---|---|
| Flatplan / MiniView | **0.55** | SPEC.md §7 B3 |
| Spread editor / FullView | `viewport.scale()`, 0.5–4.0 × base | B4 |
| **Playground FullView** | **3.0** | this packet, §4.7 |

Put every number below in `constants.ts` as a named export and import it in both the
views and the tests. A number that appears in two files will disagree in three months.

### 4.1 `createDefault(frame)` — exactly what each type returns

```ts
body     → { id: newId('body'),     type: 'body',     frame, sizePt: 9.5, leadingPt: 12, align: 'left' }
headline → { id: newId('headline'), type: 'headline', frame, sizePt: 38,  leadingPt: 40, align: 'left' }
quote    → { id: newId('quote'),    type: 'quote',    frame, sizePt: 16,  leadingPt: 20, align: 'left' }
image    → { id: newId('image'),    type: 'image',    frame }
```

- Sizes/leadings are binding (SPEC.md §7 B1).
- **`align: 'left'` on all three text types.** Only body exposes a control for it; headline
  and quote store the field so `Block.align` is consistently present and typed across
  every text block, and their views read it (they simply have no way to change it).
- **`image` stores no text attributes at all** — no `sizePt`, no `leadingPt`, no `align`.
- `frame` is passed through untouched. The reducer runs `normalizeFrame` on `block/add`,
  so an out-of-bounds frame is corrected by the kernel, not here.
- Every view must tolerate a missing or non-numeric attribute (blocks are
  `Record<string, unknown>` and documents can be imported): read through a helper that
  falls back to the defaults above.

### 4.2 MiniView — greeked bars (Layer 1)

All three text types share one renderer, parameterised by tone. Image is different (§4.5).

```
pitchPx = ptToPx(leadingPt, scale)
barPx   = pitchPx * 0.5              // NO minimum — see below
rows    = max(1, floor(frameHeightMm * scale / pitchPx))
```

Each row is a `<div>` of height `barPx` with `marginBottom: pitchPx - barPx`. Geometry is
**inline style computed from the model**, never a class (ADR-005).

| Type | Tone | className |
|---|---|---|
| body | light | `bg-greek` |
| headline | dark | `bg-greek-dark` |
| quote | mid | `bg-greek-dark/60` |

**The mid tone is an opacity modifier on a real token, not a new token.** `tokens.css`
defines only `--color-greek` and `--color-greek-dark`, and amending it would touch
`src/styles/` — outside the plugin folder. Decided in interview: B1 stays inside its
folder. `bg-greek-dark/60` over the white paper lands visually between the two.

**Bar thickness has no floor.** Decided in interview: the flatplan tells the truth about
scale, so sub-pixel bars are allowed to alias or vanish. At 0.55 px/mm a body bar is
1.16 px and a quote bar is 1.94 px — both fine; a much tighter leading would legitimately
mush.

> **[CALL]** `rows` keeps a `max(1, …)`. The "no floor" answer was about bar *thickness*;
> a row count of 0 would make a whole block invisible, which is a different failure. A
> 40 pt-leading headline in a minimum-height 8 mm frame is 7.76 px of pitch in 4.4 px of
> frame — one clipped bar rather than an empty box. Drop the `max(1, …)` if you disagree.

**Do not copy the `MIN_LEGIBLE_PX` floor from `src/plugins/example/ExampleBlock.tsx`.**
The example floors its bars to 1 px; B1 deliberately does not. The example demonstrates
one legal choice, not B1's.

### 4.3 FullView — typographic (Layer 2)

Every FullView fills its box (`size-full`) with `overflow-hidden`; the kernel's
`BlockLayer` has already positioned and sized it. Type size and leading are **inline**:
`fontSize: ptToPx(sizePt, scale)`, `lineHeight: ptToPx(leadingPt, scale) + 'px'`.

| Type | Font | Content | Alignment |
|---|---|---|---|
| body | `font-serif-body` (Georgia), `text-ink` | `greek(wordsToFill(frame.w, frame.h, attrs))` | `block.align` |
| headline | `font-ui` **bold** (see §4.10), `text-ink` | the literal string `"The shape of the page"` | `block.align` |
| quote | `font-serif-body` *italic*, `text-ink` | `greek(7)` | `block.align` |

`greek` is deterministic — the same word count always yields the same words, so nothing
shimmers between renders.

**Quote construction.** Two 1 px rules in `bg-border-hairline`, inset **2 mm** from the
frame's top and bottom edges (`2 * scale` px — 1.1 px at flatplan scale, 6 px at 3.0).
The rules are **1 px at every scale**, matching the kernel's own hairlines and §4.4's
degradation rule. The italic line sits vertically centred in the space between them.
The MiniView draws its bars between the same two rules, so both layers read as the same
object.

### 4.4 Degradation at small scale

Decided in interview. Per element, not "it'll be fine":

| Element | Rule |
|---|---|
| Greek bars (all types) | **No floor.** True `pitchPx * 0.5`; may alias or vanish (§4.2). |
| Quote top/bottom rules | **Floored to 1 px**, scale-independent. Structure, not texture. |
| Image box border | **Floored to 1 px** (`border` = 1 px already). |
| Image diagonal X strokes | **Floored to 1 px** — `strokeWidth={1}` in screen px. |
| FPO caption | **Hidden when `ptToPx(7, scale) < 5`.** 1.36 px at flatplan → absent; 7.41 px at 3.0 → present. |

The threshold constant is `FPO_MIN_PX = 5`.

### 4.5 The image block

Both layers render the same thing; only `scale` differs.

- **Box:** fills the frame. `bg-greek` fill, `border border-border-hairline`.
- **Diagonal X:** one inline `<svg>` at `size-full`, `preserveAspectRatio="none"`,
  `viewBox="0 0 100 100"`, two `<line>` elements corner-to-corner
  (`0,0 → 100,100` and `100,0 → 0,100`), `stroke-greek-dark`, `strokeWidth={1}`,
  `vectorEffect="non-scaling-stroke"` so the 1 px floor survives the viewBox scaling.
- **FPO caption:** the literal string `FPO`, `font-ui`, `text-ink-soft`, centred,
  `fontSize: ptToPx(7, scale)` **inline** — *not* the `text-micro` class (§4.10).
  Hidden below `FPO_MIN_PX`.
- **Inspector fragment:** image registers one, rendering the single line
  `No type attributes.` and no controls.

> **[CALL]** §7 says "Each with Inspector fragment", and image has no text attrs. A
> fragment with a one-line explanation satisfies that literally and stops B5 from showing
> an unexplained empty area. Registering no `Inspector` at all is the alternative.

### 4.6 Inspector fragments — commit semantics

`BlockTypeDef.Inspector` is `FC<{ block, spreadId }>`. **It has no callback slot**, so
B5 cannot wrap B1's controls: the fragment owns its own commit behaviour. And
`ctx.bus.transact` is synchronous, so a transaction cannot be held open across a drag.
Both constraints are why the rule below is what it is.

**Shared control pair** (all three text types):

| Control | Range | Step |
|---|---|---|
| Size | 6 – 72 pt | 0.5 |
| Leading | 7 – 80 pt | 0.5 |

**Align toggle — body only.** `ToggleGroup type="single"`, values `left` / `justify` /
`center`, labelled `Left` / `Justify` / `Centre`.

**Commit rule, decided in interview:**

- **During the drag:** local component state only. The numeric readout beside the slider
  updates live. **Nothing reaches the bus, so the block on paper does not move until
  release.** That is the accepted cost of "one command per completed gesture"
  (CLAUDE.md §4) given a synchronous `transact`.
- **On release:** Radix `onValueCommit` fires **exactly one**
  `{ type: 'block/update', spreadId, blockId, patch: { sizePt } }` (or `leadingPt`).
- **Align toggle:** discrete, so one `block/update` on change. No preview state.
- **A commit equal to the current value dispatches nothing** — guard on
  `next !== current`. (The bus would log it and correctly take no history step, but an
  inert log entry is noise for P9.)
- When the `block` prop changes identity (undo, another surface's edit), the local
  preview state resyncs from the prop.

This is the rule §7 B5 states, living in B1 because B1 owns the fragments. **B5 must not
re-implement it.**

### 4.7 The playground view

§7's B1 human test is "all four render correctly in both layers" — but with
`PLUGIN_LIST = [blocksBasic]` there is no tool (B2), no flatplan (B3) and no spread
editor (B4), so the shell falls through to the placeholder and nothing renders. Decided
in interview: B1 registers one view so its own acceptance is performable today. SPEC.md
§1 makes the playground arena "central product surface, not side rooms", so this is a
legitimate permanent surface, not scaffolding.

- **Route:** `/playground/blocks-basic`. Id `blocks-basic-playground`.
- **The spread is synthetic.** The view builds a `Spread` object **in memory** and passes
  it to `SpreadPaper`. It **dispatches nothing, persists nothing, and never touches the
  user's document.** `BlockLayer` resolves views from the registry, not from the
  document, so this works. `page` comes from `useDocument().page` so the demo tracks real
  page setup.
- **Two `SpreadPaper` instances, stacked**, each under a `font-ui text-label
  tracking-caps text-ink-soft uppercase` heading:
  1. `mode="mini"  layer="flatplan" scale={0.55}` — heading `Layer 1 · flatplan · 0.55 px/mm`
  2. `mode="full"  layer="spread"   scale={3.0}`  — heading `Layer 2 · spread · 3.0 px/mm`
- 3.0 px/mm ≈ 80 % of life size, so 9.5 pt body renders at 10.05 px — actually legible,
  which is the point of the surface. The spread is then 1260 × 840 px; wrap both in an
  `overflow-auto` container. The shell's desk already scrolls.
- **Four demo blocks**, one per type, built with each type's own `createDefault` so the
  playground cannot drift from the defaults:

| Type | frame (mm, spread space) | Sits on |
|---|---|---|
| headline | `{ x: 13,  y: 18,  w: 182, h: 30  }` | left page, top of text area |
| body | `{ x: 13,  y: 54,  w: 182, h: 150 }` | left page, under it |
| quote | `{ x: 225, y: 18,  w: 182, h: 60  }` | right page, top |
| image | `{ x: 225, y: 88,  w: 182, h: 120 }` | right page, under it |

All four are inside the margin boxes for `DEFAULT_PAGE` (left text area x 13–195, right
225–407, text band y 18–256) and all exceed the 14 × 8 mm minimum.

- `selectedIds` is `[]`. Selection is B3/B4/B5's business.
- No `PanelDef`, so the Inspector fragments are **not** reachable from the playground.
  They are covered by unit tests (§6) until B5 lands. Say so in the view: one line of
  `font-ui text-micro text-ink-soft` reading
  `Inspector fragments appear in the panel dock once B5 inspector is loaded.`

### 4.8 Fidelity

**No `FidelityBadge` anywhere in B1.** Decided in interview.

B1 renders greeked shapes at a size. It calls `wordsToFill` — which uses the same
0.5 × `sizePt` approximation as `measure()` — but only to decide *how much filler to
emit*, and that result is never shown to the reader. There is no fill %, no overflow
state, no line count on any B1 surface. SPEC.md §4.10's rule binds surfaces that show
**measured text**; greeking is not a measurement claim.

P2 `copyflow`, which displays real fill percentages, is where the badge starts.

### 4.9 Bounds and validation

| Thing | Rule |
|---|---|
| `sizePt` | 6–72, step 0.5. Clamp on read; the slider cannot produce out-of-range. |
| `leadingPt` | 7–80, step 0.5. Same. |
| `align` | one of `left` / `justify` / `center`; anything else reads as `left`. |
| Missing/NaN attribute | falls back to the §4.1 default for that type. |
| `rows` in a MiniView | `max(1, floor(…))`; never negative, never 0. |
| Frame | B1 never writes a frame. B2 draws, B5 edits geometry. |

### 4.10 Conflicts in the source spec, and how they were resolved


Two places where SPEC.md §7 B1 contradicts SPEC.md §3 / `tokens.css`. Both resolved in
favour of §7, which §7 itself declares binding ("Fixed numeric points repeated here are
binding"). Recorded so a reviewer sees a decision rather than a slip.

1. **Headline is "bold sans" — but §3 says UI type (Inter) stays off paper.**
   Resolved: headline uses `font-ui` bold *on paper*, because §7 B1 specifies it
   explicitly for this one block type. It is the only place UI type appears on paper.
2. **Image has an "FPO" micro-caption — but `tokens.css` says the micro-type tokens are
   "Quiet UI type only — never used on paper".**
   Resolved: the caption is `font-ui` at `fontSize: ptToPx(7, scale)` **inline**, not the
   `text-micro` class. This satisfies both rules at once — it is document type sized from
   a point value, which §3 requires to be inline anyway — and is why the caption gets a
   pt size rather than a token class.

Neither needs a kernel or token change.

---

## 5. Keyspace

**none.** B1 persists nothing. Everything it owns lives on the block, inside
`DocumentV1`, which is correct: `sizePt` / `leadingPt` / `align` *are* the block
(CLAUDE.md §5's stated exception), not preferences about it.

`ctx.storage` is never called.

---

## 6. Acceptance

**Automated**

- [ ] `pnpm typecheck && pnpm lint && pnpm lint:boundaries && pnpm test && pnpm build && pnpm e2e`
- [ ] `createDefault` returns exactly §4.1 for each of the four types — field by field,
      including that `image` has **no** `sizePt` / `leadingPt` / `align` key
- [ ] Bar arithmetic: at `scale = 0.55`, a body block of `h = 150 mm` yields
      `pitchPx ≈ 2.328`, `barPx ≈ 1.164`, `rows = 35`; assert against `constants.ts`
- [ ] `rows >= 1` for a minimum-height frame at every type's default leading
- [ ] FPO caption hidden at `scale = 0.55`, present at `scale = 3.0`
      (`ptToPx(7, 0.55) = 1.36 < 5 <= 7.41 = ptToPx(7, 3.0)`)
- [ ] **Log-length assertion:** driving a size slider through N intermediate values and
      one commit appends **exactly one** entry to `getLog()`, with `cmd.type ===
      'block/update'` and `source === 'blocks-basic'`
- [ ] A commit equal to the current value appends **zero** entries
- [ ] All four types register and all four disappear on `host.unloadAll()`
- [ ] The playground view dispatches nothing: `getLog().length` is unchanged across a
      render of `PlaygroundView`
- [ ] No token violations: grep the folder for `[#` and `px]` inside `className` — zero hits

**Independence** (SPEC.md §4.5 rule 5)

- [ ] `pnpm verify:plugin blocks-basic` — nothing outside `src/plugins/blocks-basic/`
      except one line in `src/shell/plugins.ts` and this packet
- [ ] In particular: **`src/styles/tokens.css` is unchanged** (§4.2 uses an opacity
      modifier precisely so it stays unchanged)

**Removal** (SPEC.md §4.5 rule 4)

- [ ] `pnpm verify:plugin blocks-basic` removal check passes

**Boot** — `PLUGIN_LIST = [blocksBasic]`, navigate to `/playground/blocks-basic`

- [ ] Two `SpreadPaper` elements, four blocks each, eight `[data-block-id]` in total
- [ ] Zero `[data-block-type]` elements showing the kernel's dashed "unknown type"
      placeholder — every type resolves
- [ ] **Zero console errors and zero console warnings** (the e2e boot spec already
      asserts this shape; follow it)
- [ ] `/` still shows the placeholder view — B1 registers no root route

---

## 7. Human test script

A person with a mouse, `pnpm dev`, and `PLUGIN_LIST = [blocksBasic]`.

1. Open `http://localhost:5173/`. **Expect:** the daylight desk and the "No plugins
   loaded" placeholder — B1 owns no root route, and that is correct.
2. Go to `http://localhost:5173/playground/blocks-basic`. **Expect:** two sheets of white
   paper stacked vertically, each two pages wide with a centre gutter hairline, under the
   headings "Layer 1 · flatplan · 0.55 px/mm" and "Layer 2 · spread · 3.0 px/mm".
3. Look at the **top (Layer 1)** sheet. **Expect:** four grey shapes — a short block of
   dark bars top-left, a tall block of light bars below it, a small block of mid-grey bars
   top-right between two hairlines, and a light box with a diagonal cross bottom-right.
   **The cross has no "FPO" label at this size** — that is the degradation rule working.
4. Compare the three bar blocks. **Expect:** three visibly different greys, and the top-left
   (headline, 40 pt leading) bars are visibly thicker and further apart than the tall
   left-hand (body, 12 pt leading) bars.
5. Look at the **bottom (Layer 2)** sheet. **Expect:** real type. Top-left reads
   "The shape of the page" in large bold sans. Below it, a column of small Georgia
   pseudo-Latin. Top-right, one line of italic Georgia between two hairlines. Bottom-right,
   the same box and cross **now labelled "FPO"**.
6. Read the bottom sheet's headline and body. **Expect:** the headline is roughly four
   times the height of the body type (38 pt vs 9.5 pt).
7. Reload the page. **Expect:** identical text in every block — greeking is deterministic,
   so nothing shimmers or reshuffles.
8. Open the browser console. **Expect:** no errors and no warnings.
9. Resize the window narrow enough to force horizontal scrolling. **Expect:** both sheets
   scroll within their container; the page body itself does not break.

**Pass** = all nine without confusion or console output.

**Not testable this lot, and that is expected:** the Inspector fragments (no panel dock
until B5), selection outlines (B3/B4), and drawing a block (B2). Unit tests cover the
fragments' commit behaviour in the meantime (§6).

---

## 8. Do-not-touch

Constant part:

- `src/kernel/**` — frozen; amendment needs a demonstrated need and a new ADR (CLAUDE.md §2).
  **B1 needs none.**
- `src/shell/**` — except the **single** load-list line in `src/shell/plugins.ts`
- Every other `src/plugins/<other-id>/` folder, including `src/plugins/example/`
- `src/components/ui/**` — vendored shadcn; tokens and variants only
- `src/styles/tokens.css` — **specifically relevant here.** §4.2's mid tone is an opacity
  modifier precisely so this file stays untouched. Do not add `--color-greek-mid`.

Packet-specific:

- **Do not register a tool.** B2 `tools-basic` owns drawing, moving and deleting.
- **Do not register a panel.** B5 `inspector` owns the dock; B1 owns only the fragments
  B5 renders inside it.
- **Do not register a `/` route.** B3 `flatplan` owns it.
- **Do not implement snapping.** B2 and B4 own it.
- **Do not copy `MIN_LEGIBLE_PX` from `src/plugins/example/`** (§4.2).

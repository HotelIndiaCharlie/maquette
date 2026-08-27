---
title: Maquette kernel API — the plugin author's reference
kernel-api-version: 1
kernel-api-hash: dc8f539c57bc
kernel-api-exports: 177
guarded-by: test/plugin-api-version.test.ts
---

# The kernel API, as a plugin sees it

This file is derived from `src/kernel/index.ts`, **not** from `SPEC.md`. Where the two
disagree, the code wins and the disagreement is recorded in §0 below.

Everything a plugin may use is re-exported from one module:

```ts
import { /* … */ } from '@/kernel';
```

There is no second door. `@/kernel/model/types` is a lint error, not a shortcut.

> **Anti-hallucination rule.** If a symbol is not in this file, it is not in the plugin
> surface. Do not guess a signature, do not "remember" one from the PRD, and do not add
> one. If your plugin needs an API that is not here, write
> **`BLOCKED: requires kernel amendment`** in the work packet and stop (CLAUDE.md §12,
> SPEC.md §6.2). During Lot 1 an amendment is *possible* — demonstrated built-in need
> plus a new ADR — but it is a decision a human makes, never one you make silently.

---

## 0. Where reality differs from SPEC.md

Five deliberate, documented deviations. A session working from the PRD alone will both
miss what exists and invent what doesn't; these are the five places that happens.

| # | SPEC.md says | The kernel actually does | Why | ADR |
|---|---|---|---|---|
| 1 | §4.7 puts the canvas host in `src/shell`. | `SpreadPaper`, `BlockLayer`, `OverlayLayer` are **kernel** exports (`src/kernel/canvas/`). The shell keeps only the desk, tool rail, error boundary and routed slot. | B3 and B4 must render *identical* paper, and §4.5 rule 2 forbids a plugin importing the shell. Two plugins sharing something they cannot import is kernel criterion (a). | [001](adr/001-kernel.md) |
| 2 | §4.3 lists `dispatch` / `getLog` / `subscribeDoc`. | The plugin bus also has **`transact(label, fn)`**, **`getDocument()`** and **`subscribeLog()`**; the kernel bus additionally has **`replaceDocument(doc)`**. | `transact` is how "one command per gesture" survives a gesture that needs several commands. `getDocument()` is how a view renders its first frame. `replaceDocument` exists because importing a file is not an edit. | [002](adr/002-command-bus.md) |
| 3 | §4.5 shows `registry: { … } // register* fns`. | `ctx.registry.*` exposes the **full** `Registry`: `register` / `list` / `get` / `subscribe`. | B5's inspector must find B1's `Inspector` fragment without importing B1. Read access to the registry is how one plugin composes with another's contribution. | [003](adr/003-plugin-contract.md) |
| 4 | Nothing about a shared active tool. | **`activeTool`** and **`forwardPointer(phase, e, layer)`** are kernel exports. | The shell renders the tool rail; *plugins* render the canvas surfaces that receive pointer events. Both must agree on the active tool without importing each other. | [003](adr/003-plugin-contract.md) |
| 5 | No mention of React hooks. | Eight hooks are exported for plugin use: `useDocument`, `useSpread`, `useSelection`, `useViewport`, `useRegistry`, `useActiveTool`, `useCommandLog`, `useHistoryState`. | Every registered view/fragment is a React component; subscribing by hand in `useEffect` in every one of them is the bug farm the hooks exist to close. | — |

Two fixed bugs, recorded so they are not reintroduced by a plugin that reimplements
what the kernel already does:

- Documents and sidecars live in **separate IndexedDB databases** (`maquette-documents`,
  `maquette-sidecar`). `idb-keyval`'s `createStore()` provisions one object store per
  database — one shared DB with two stores does not work.
- `measure()` rounds `usedHeightMm` **once** and derives `fill` from the rounded value.
  A surface reporting "25.4 mm used" and "25 % full" must not be quoting two different
  numbers.

---

## 1. What a plugin may import

**Allowed — this is the complete list** (`ALLOWED_PLUGIN_IMPORTS`):

| Specifier | For |
|---|---|
| `@/kernel` | everything in this document |
| `@/components/ui` | vendored shadcn primitives — tokens and variants only |
| `@/styles` | `tokens.css`, the only source of style values |
| `./…` inside your own folder | your own modules |

Plus ordinary third-party runtime deps already in `package.json` that are not on the
forbidden list — in practice `react`, `react-dom`, `react-router-dom`, `lucide-react`,
`clsx`, `class-variance-authority`, `tailwind-merge`, `zod`, `immer`, `zustand`.

**Forbidden — with the exact ESLint message you will see** (`eslint.config.js`; the
fixture test `test/boundaries.test.ts` lints violating source through this real config,
so these cannot be loosened without CI going red):

| Pattern | Message |
|---|---|
| `@/plugins/*`, `@/plugins/*/**` | *Cross-plugin imports are forbidden (SPEC.md §4.5 rule 2). Share through the kernel instead.* |
| `@/shell`, `@/shell/**` | *Plugins may not import the shell (SPEC.md §4.5 rule 2).* |
| `@/kernel/*`, `@/kernel/*/**` | *Import the kernel public API only: `@/kernel`. Kernel internals are not a plugin surface (SPEC.md §4.5 rule 2).* |
| `idb-keyval`, `idb-keyval/**` | *Plugins never touch IndexedDB directly — use ctx.storage(namespace) (SPEC.md §4.5 rule 3).* |
| `../` escaping the plugin folder (depth-scoped: `../` at `src/plugins/<id>/x.ts`, `../../` at `src/plugins/<id>/a/x.ts`, and so on to depth 3) | *This relative import leaves the plugin folder. A plugin lives entirely in src/plugins/<id>/ (SPEC.md §4.5 rule 1).* |
| global `localStorage` | *Plugin data lives in ctx.storage(namespace) sidecars (SPEC.md §4.5 rule 3).* |
| global `indexedDB` | *Plugin data lives in ctx.storage(namespace) sidecars (SPEC.md §4.5 rule 3).* |

**If you nest deeper than `src/plugins/<id>/a/b/c.ts`,** the depth-scoped relative-escape
rule stops covering you. Extend `eslint.config.js` — but that is a file outside your
folder, so it is a packet-level decision, not a silent one. Three levels is enough for
every built-in; prefer flattening.

`ALLOWED_PLUGIN_IMPORTS` and `FORBIDDEN_PLUGIN_IMPORTS` are exported as data, so a test
can assert against them rather than restating them.

---

## 2. Register things

Five registries; **they are the entire surface on which a plugin can add something
visible.** Nothing else in the kernel renders plugin content.

```ts
interface Registry<T extends { id: string }> {
  register(def: T): () => void;   // returns its own disposer
  list(): ReadonlyArray<T>;
  get(id: string): T | undefined;
  subscribe(cb: (defs: ReadonlyArray<T>) => void): () => void;
}
type Layer = 'flatplan' | 'spread' | 'both';
```

Reach them through `ctx.registry.{blockTypes,tools,overlays,panels,views}` — that facade
tracks every registration and disposes it when the plugin unloads, which is what makes
"removal leaves the app running" true at runtime and not just at build time. The bare
`blockTypes` / `tools` / `overlays` / `panels` / `views` / `registries` exports exist for
the shell and for tests; a plugin registering directly on them leaks.

Registering a duplicate id throws `DuplicateRegistrationError`, which the loader catches
and turns into a failed plugin with a toast — not a white screen.

| Type | Shape | When |
|---|---|---|
| `BlockTypeDef` | `{ id, label, createDefault(frame: Rect): Block, MiniView: FC<{block, scale}>, FullView: FC<{block, scale}>, Inspector?: FC<{block, spreadId}> }` | You are adding a kind of thing that lives on paper. `MiniView` is Layer 1 (flatplan, greeked); `FullView` is Layer 2 (spread editor, typographic). |
| `ToolDef` | `{ id, label, icon: ReactNode, layer: Layer, onDown?, onMove?, onUp? }` — handlers take `SpreadPointerEvent` | You are adding a mode the tool rail can select. Handlers only fire via `forwardPointer`. |
| `OverlayDef` | `{ id, layer: Layer, zIndex: number, View: FC<{spreadId, scale}> }` | You are drawing *above* paper — guides, grids, handles. The layer is `pointer-events-none`; an overlay that is an affordance re-enables them on its own element with `pointer-events-auto`. |
| `PanelDef` | `{ id, title, order: number, View: FC, visible?: () => boolean }` | You are docking a panel (right rail ≥760 px, bottom sheet below). Sorted by `order`. |
| `ViewDef` | `{ id, route: string, View: FC }` | You own a route. `route` is a react-router path — `/`, `/spread/:id`, `/playground/x`. |

`BlockTypeDef.createDefault(frame)` must return a complete `Block` including `id` and
`type`. Use `newId('<type>')`. The kernel normalises the frame on `block/add`, so a
default that is slightly out of bounds is corrected, not rejected.

A document containing a block whose type no plugin provides does **not** crash: the
`BlockLayer` renders a dashed placeholder showing the type name. Removing your plugin is
therefore visibly safe.

---

## 3. Read the document

```ts
type Rect      = { x: number; y: number; w: number; h: number };            // mm
type BlockBase = { id: string; type: string; frame: Rect };                 // type = registry key
type TextAttrs = { sizePt: number; leadingPt: number; align: 'left'|'justify'|'center' };
type Block     = BlockBase & Partial<TextAttrs> & Record<string, unknown>;
type Spread    = { id: string; cols: number; blocks: Block[] };
type PageSetup = { wMm; hMm; margins: {top;bottom;inside;outside}; columnGutterMm };
type DocumentV1= { schemaVersion: 1; id; title; updatedAt; page: PageSetup; spreads: Spread[] };
```

**Geometry is millimetres in spread space.** Origin at the top-left of the *left* page;
x runs across both pages (`0 … 2 × page.wMm`); y runs down one page height
(`0 … page.hMm`).

**`Block` is open.** `Record<string, unknown>` means a block type may store extra
serialisable keys on its own blocks — and `blockSchema` is a `looseObject`, so they
survive save/load. This is the one exception to "plugin data never lives in
`DocumentV1`": data that *is* the block belongs on the block. Anything else
(preferences, manuscripts, pins) is a sidecar. Reading an unknown key off someone else's
block is legal but requires a narrowing check — `Record<string, unknown>` gives you
`unknown`, and there is no `any` to hide behind.

| Export | Signature | Use / rule |
|---|---|---|
| `useDocument()` | `(): DocumentV1` | The current document, re-rendering on change. The normal way a view reads. |
| `useSpread(id)` | `(id: string \| null \| undefined): Spread \| undefined` | One spread by id. Returns `undefined` for a stale id — handle it, don't assert. |
| `ctx.bus.getDocument()` | `(): DocumentV1` | Imperative read, outside React (a tool's `onDown`). |
| `ctx.bus.subscribeDoc(cb)` | `(cb: (doc: DocumentV1) => void): Dispose` | Imperative subscription. Taken through `ctx.bus` it is auto-disposed with the plugin. |
| `DEFAULT_PAGE` | `PageSetup` | 210 × 280 mm, margins 18/24/15/13, 4 mm gutter. |
| `MIN_BLOCK_W_MM` / `MIN_BLOCK_H_MM` | `14` / `8` | The kernel's minimum frame. Enforced in `normalizeFrame`; you cannot persist smaller. |
| `DEFAULT_COLS` / `MIN_COLS` / `MAX_COLS` | `3` / `1` / `12` | Column count bounds. |
| `spreadWidthMm(page)` / `spreadHeightMm(page)` | `(page): number` | `2 × wMm` and `hMm`. Use these, never `page.wMm * 2` inline. |
| `normalizeFrame(frame, page)` | `(Rect, PageSetup): Rect` | Clamp to the minimum size and to the spread. Call it to *preview* what the reducer will store — the reducer calls it regardless. |
| `round3(n)` | `(n): number` | Micron precision. Millimetres are stored at 3 dp. |
| `documentV1Schema` / `parseDocument` / `safeParseDocument` | zod | Validate a document you are importing. `safeParseDocument` returns `{ok:true,doc}` or `{ok:false,error}`. |
| `CURRENT_SCHEMA_VERSION` / `migrate(raw)` | | Schema version and its migration ladder. |
| `createEmptyDocument(title?)` / `createSeedDocument(title?)` | | Empty, and the three-spread 3/2/3 seed. |
| `newId(prefix)` | `(prefix: string): string` | `prefix_xxxxxxxx`. The only id generator; use it for block ids. |
| `KernelError` | `class` | What the kernel throws on an invalid command or unknown spread. A programming error, not a user error. |
| `reduce(doc, cmd, ctx)` | pure | Exported for tests. **Do not** call it to mutate — that bypasses the log. |

---

## 4. Mutate — through the bus, and only the bus

```ts
type Command =
  | { type: 'block/add';    spreadId: string; block: Block }
  | { type: 'block/update'; spreadId: string; blockId: string; patch: Partial<Block> }
  | { type: 'block/remove'; spreadId: string; blockId: string }
  | { type: 'spread/add' }
  | { type: 'spread/update'; spreadId: string; patch: { cols?: number } }
  | { type: 'doc/update';   patch: { title?; updatedAt?; page?: Partial<PageSetup> } };
```

**That is the complete command set.** There is no `block/move`, no `block/resize`, no
`spread/remove`, no `block/reorder`. Moving and resizing are `block/update` with a
`frame` patch. If you need a command that is not listed, that is a kernel amendment —
`BLOCKED`.

| Export | Signature | Use / rule |
|---|---|---|
| `ctx.bus.dispatch(cmd)` | `(cmd: Command): void` | **The only door to mutation.** Stamps `source = pluginId` on the log entry. Direct store or storage writes are bugs (CLAUDE.md §4). |
| `ctx.bus.transact(label, fn)` | `<T>(label: string, fn: () => T): T` | Several commands, **one undo step, one log group**. This is how a gesture that needs more than one command still honours "one command per completed gesture". Nests safely. Throwing inside rolls the whole group back. |
| `ctx.bus.getLog()` / `subscribeLog(cb)` | | The command log: `{ ts, cmd, source, groupId?, label? }`. Capped at 5000 entries. |
| `useCommandLog()` | `(): ReadonlyArray<LogEntry>` | The log, in React. |
| `useHistoryState()` | `(): { canUndo: boolean; canRedo: boolean }` | For enabling undo/redo affordances. |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` | | History, capped at `MAX_HISTORY_DEPTH` = 200. Not on `ctx.bus` — the shell's top bar owns the buttons. A plugin binding its own undo key uses these directly. |
| `validateCommand(cmd)` | `(cmd): void` | Throws `KernelError` on an invalid command. The bus calls it; call it yourself only to fail early in a test. |
| `dispatch` / `dispatchAs` / `transactAs` / `replaceDocument` / `subscribeDoc` / `subscribeHistory` | | Kernel-level entry points. `dispatch` stamps `source: 'kernel'` — **a plugin using it loses attribution and breaks the log**. Use `ctx.bus`. `replaceDocument` is for import/boot and clears history; it is not an edit. |

**Behaviour you must design around, not against:**

- A **no-op keeps document identity.** Patching a block that no longer exists returns the
  same document reference: it is logged (the intent happened) but takes no history step,
  so undo never has an inert rung. Do not "fix" this by dispatching a dummy command.
- **A drag previews locally and commits once on pointer-up.** Local component state
  during the gesture, one `dispatch` (or one `transact`) at the end. Log-length
  assertions in your tests are how this is enforced.
- **Reducers enforce the invariants.** `normalizeFrame` runs on every `block/add` and on
  every `block/update` carrying a `frame`. You cannot persist a frame below 14 × 8 mm or
  outside the spread.
- `updatedAt` is maintained by the bus. Never patch it yourself.

---

## 5. Selection · viewport · pointer · geometry

### Selection

```ts
type SelectionState = { blockIds: string[]; spreadId: string | null };
interface SelectionApi { get(); set(sel); clear(); subscribe(cb): Dispose }
```

| Export | Use / rule |
|---|---|
| `ctx.selection` | The one selection every layer agrees on. Flatplan outlines it, the editor handles it, the inspector edits it, delete consumes it. |
| `useSelection()` | `(): SelectionState` in React. |
| `selectOnly(spreadId, blockId)` | The common single-block case. |
| `isSelected(blockId)` | Imperative membership test. |
| `selectedBlocks()` | The selected `Block` objects, resolved against the current document. |

The kernel **prunes the selection automatically**: blocks removed by any command or by an
undo drop out of it. No plugin ever has to defend against a ghost id.

### Viewport

```ts
interface ViewportApi {
  mmToScreen(p: Point): Point;  screenToMm(p: Point): Point;
  scale(): number;              // px per mm  ( = baseScale × zoom )
  zoom(): number;  setZoom(z: number, aroundScreenPt?: Point): void;   // clamped 0.5–4.0
  subscribe(cb: (s: ViewportState) => void): Dispose;
}
type ViewportState = { baseScale: number; zoom: number; origin: Point };
```

**There is one viewport instance,** not one per editor. SPEC.md §4.6 says "per
spread-editor instance"; the prototype shows at most one editor at a time, so the kernel
owns a single viewport that the editor configures on mount and resets on unmount
(ADR-001). `MIN_ZOOM` = 0.5, `MAX_ZOOM` = 4.0. `setZoom(z, aroundScreenPt)` keeps the mm
coordinate under that screen point fixed — that is cursor-anchored zoom.

`useViewport()` returns the state. Note the flatplan does **not** use the viewport: its
cards have their own fixed scale passed down as the `scale` prop.

### Pointer

```ts
type SpreadPointerEvent = { mm: {x,y}; spreadId: string; raw: PointerEvent };
toSpreadPoint(raw, { element, scale, spreadId, origin? }): SpreadPointerEvent
clientToMm(client, rect, scale, origin?): {x,y}       // pure, for tests
forwardPointer(phase: 'down'|'move'|'up', e, layer: 'flatplan'|'spread'): boolean
```

A canvas surface converts with `toSpreadPoint`, then hands the event to
`forwardPointer`, which routes it to the **active tool** if that tool serves this layer.
Returns `true` when a tool handled it. Tools never see client coordinates.

`activeTool` — `{ get(): string|null; set(id); subscribe(cb) }` — and `useActiveTool()`
are the shared state between the shell's rail and plugin-rendered surfaces.

### Geometry — all pure, all mm, all table-tested

| Export | Value / signature |
|---|---|
| `PT` | `0.3528` mm per point |
| `ptToMm` / `mmToPt` / `mmToPx(mm, scale)` / `pxToMm(px, scale)` | conversions; `scale` is px per mm |
| `ptToPx(pt, scale)` | **font size in px at a viewport scale — the only correct way to set type on paper** |
| `roundTo(value, stepMm)` | rounding to a step |
| `COARSE_COLS` / `COARSE_ROWS` | `6` / `8` — the flatplan draw grid is `pageW/6 × pageH/8` |
| `coarseCell(page)` | `{ wMm, hMm }` of one coarse cell |
| `pageTextLefts(page)` | `[leftPageTextLeft, rightPageTextLeft]` in spread space |
| `textWidthMm(page)` | one page's text-area width |
| `columnWidthMm(page, cols)` | one column's width |
| `marginBoxes(page)` | the two text areas as rects |
| `columnEdges(page, cols)` | every vertical snap candidate, both pages, sorted and de-duplicated |
| `baselines(page, leadingPt)` | y positions from the top margin down to the bottom margin |
| `snapXFine` / `snapYFine` / `snapPointFine(p, ctx)` | fine snap → `{ value, snapped, guideMm? }`; `ctx: { page, cols, leadingPt, enabled? }` |
| `snapPointCoarse(p, page)` / `snapRectCoarse(a, b, page)` | coarse snap; the rect is never smaller than one cell |
| `SNAP_X_TOLERANCE_MM` / `SNAP_Y_TOLERANCE_MM` / `FALLBACK_STEP_MM` | `3` / `2` / `1` |

`guideMm` on a `SnapResult` is the guide that matched — that is what a snap flash
renders. `enabled: false` in the `SnapContext` degrades to rounding at 1 mm.

---

## 6. Canvas primitives — paper

Kernel exports, not shell (deviation 1).

```tsx
<SpreadPaper
  spread={spread} page={doc.page} scale={pxPerMm}
  mode="mini" | "full"
  layer="flatplan" | "spread"
  selectedIds={[...]}          // optional; draws a 1px `mark` outline
  className? style? children?
  onPointerDown? onPointerMove? onPointerUp? onPointerCancel?
/>
```

It renders **geometry only**: a white rectangle `2 × wMm` by `hMm` at `scale`,
`shadow-paper`, and the centre gutter hairline. Then it mounts `BlockLayer` (registered
Mini/Full views, absolutely positioned from each block's frame) and `OverlayLayer`
(registered overlays for this layer, sorted by `zIndex`). It forwards a ref to the paper
element — which is what you pass to `toSpreadPoint` as `element`.

`BlockLayer` and `OverlayLayer` are exported separately for the rare case of composing
them by hand. `SpreadPaper` is what you want.

**Your Mini/Full views receive `{ block, scale }` and render inside a box the layer has
already sized and positioned, with `overflow: hidden`.** Fill it — `size-full` — and do
not position yourself. `scale` is px per mm; at flatplan scale it is ≈0.55, in the
editor it is `viewport.scale()`.

---

## 7. Text seam

```ts
ctx.text.greek(nWords: number): string
ctx.text.measure(text, widthMm, attrs: TextAttrs & { heightMm? }): Measurement
ctx.text.wordsToFill(widthMm, heightMm, attrs: TextAttrs): number
ctx.text.FidelityBadge: FC<{ fidelity: 'greeked' | 'working-proof'; className? }>
```

```ts
type Measurement = {
  lines: number; overflow: boolean;
  charsPerLine: number; usedHeightMm: number; fill: number;  // 0..1, or 0 without heightMm
};
```

- `greek(n)` is **deterministic**: the same `n` always yields the same words, so greeked
  layouts do not shimmer between renders. Vocabulary is the printer's own. It returns a
  trailing full stop; `greek(0)` is `''`.
- `measure` is a **stated approximation** — average character width is
  `AVG_CHAR_WIDTH_RATIO` (0.5) × `sizePt`, in mm. Not kerned, not hyphenated, not
  font-aware. The seam exists so a real engine can replace it without any plugin
  changing.
- **Fidelity honesty rule (SPEC.md §4.10, CLAUDE.md-adjacent):** *any surface showing
  measured text must render `FidelityBadge`.* "Measured" means you called `measure()` and
  showed the reader something derived from it — a fill %, an overflow state, a line
  count. Rendering greeked shapes at a size is not measuring. **Maquette never claims
  print truth.** If you are unsure whether your surface measures, it is cheaper to render
  the badge than to argue.
- `GREEK_VOCABULARY` exists inside `kernel/text` but is **not** re-exported from
  `@/kernel`. It is not part of the plugin surface.
- The same seam is available as `textApi` (the object `ctx.text` is bound to) and as bare
  `greek` / `measure` / `wordsToFill` / `FidelityBadge` exports, for tests.

---

## 8. Storage — sidecars, and nothing else

```ts
ctx.storage<T>(namespace: string): SidecarStore<T>

interface SidecarStore<T> {
  get(key: string): Promise<T | null>;
  set(key: string, v: T): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  remove(key: string): Promise<void>;
}
```

Keys are prefixed `${pluginId}:${namespace}` by the kernel. You cannot collide with
another plugin and you cannot read one by accident.

**Rules:**

- **Plugin data lives in sidecars, never inside `DocumentV1`** (CLAUDE.md §5). The one
  exception is data that *is* the block — extra keys on your own block type (§3).
- **Never touch `localStorage`, `indexedDB` or `idb-keyval`.** Lint error, with the rule
  number in the message.
- Everything is `Promise`-based. A view that reads a sidecar renders a sensible default
  first and updates when the read resolves. There is no synchronous sidecar read.
- **Reading another plugin's sidecar** (P6/P8 do this) is *not* possible through
  `ctx.storage` — the prefix is yours. Cross-plugin data sharing is a packet-level
  design question with no current kernel answer: if your plugin needs it, say so in the
  packet's *Consumes* section explicitly, and expect `BLOCKED: requires kernel amendment`
  unless the producing plugin publishes it some other way (a registry entry, a block key).
- Declare every namespace and key shape in the packet's **Keyspace** section, or write
  "none".

`indexedDbAdapter`, `createSidecar`, `sidecarFactoryFor`, `createMemoryAdapter`,
`createMemorySidecarSpace`, `startAutosave`, `AUTOSAVE_DEBOUNCE_MS`, `StorageAdapter`,
`DocumentSummary`, `AutosaveHandle` are exported for the shell and for tests.
`createMemorySidecarSpace` is the one you want in a unit test.

---

## 9. Jobs and ChangeSets

No built-in uses this. P6/P7/P8 do.

```ts
ctx.jobs.run(req: JobRequest): JobHandle
type JobRequest = { kind: string; payload: unknown;
                    scope: { spreadIds: string[]; lockedBlockIds?: string[] } };
type JobHandle  = { id; status(): JobStatus; onProgress(cb); onPartial(cb);
                    cancel(): void; result: Promise<ChangeSet> };
type ChangeSet  = { id; label; groups: Array<{ id; label; commands: Command[] }> };
applyChangeSet(cs, { acceptGroupIds? }): ApplyResult
```

- **Nothing auto-applies.** A ChangeSet reaches the document only through
  `applyChangeSet`, which dispatches every command inside one `transact` — undoable as a
  unit, logged, attributed (CLAUDE.md §9).
- **Accept and reject are per intent group**, never per micro-command.
- **`scope.lockedBlockIds` is a displayed guarantee, not advice.** `changeSetTouches(cs,
  ids)` and `blockIdsTouched(cmd)` exist so it is assertable — assert it.
- `cancel()` **rejects** `result` with `JobCancelledError`. A cancelled job has no result;
  never treat "no change" as success.
- `mockExecutor` / `createMockExecutor` is deterministic: seeded 2–8 s latency
  (`MOCK_MIN_LATENCY_MS` / `MOCK_MAX_LATENCY_MS`), `MOCK_PROGRESS_TICKS` = 10 ticks, one
  partial at the halfway mark, two demo kinds (`nudge-baselines`, `echo`).

---

## 10. Flags, lifecycle, and the manifest

```ts
export const plugin: MaquettePlugin = {
  id: 'my-plugin',        // folder name === id, kebab-case, /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  name: 'My plugin',
  version: '0.1.0',
  flag: 'my-plugin',      // optional — the plugin loads only when the flag is on
  register(ctx) { /* … */ return () => { /* … */ }; },
};
```

- `id` must match `PLUGIN_ID_PATTERN` **and** the folder name. `assertValidManifest`
  checks the pattern, `name`, `version` and `register` at load.
- **Every built-in is unflagged; every probe is flagged** (SPEC.md §8).
- `ctx.flags.get(name): boolean` is read-only. The shell owns flag state (URL
  `?flags=a,b`, then `localStorage`).
- `register` may return a `Dispose`. Everything taken through `ctx.registry` and
  `ctx.bus.subscribe*` is tracked and disposed for you; return a disposer for anything
  else you set up (a `window` listener, a timer, a `ctx.selection.subscribe`).
- `register` runs in a try/catch. A throw rolls back that plugin's registrations, marks it
  `failed`, and raises a toast — the rest of the list still loads. A component that throws
  while *rendering* is caught by the shell's `ErrorBoundary`.
- `disposeAll(disposers)` composes several `Dispose`s into one.
- `loadPlugins`, `createPluginContext`, `PluginHost`, `LoadedPlugin`, `PluginStatus` are
  the loader's own surface — useful in your plugin's unit test to load yourself against a
  memory sidecar and assert your registrations appear and then disappear.

**The one line outside your folder.** `src/shell/plugins.ts` holds `PLUGIN_LIST`. Adding
your plugin is one import and one entry there — and *nothing else* outside
`src/plugins/<id>/`. That is the acceptance rule (SPEC.md §4.5 rule 5), checked with
`git diff`.

---

## 11. Style — what the tokens allow

`src/styles/tokens.css` is the **only** source of style values (ADR-005). An arbitrary
Tailwind value — `bg-[#fff]`, `text-[13px]` — is a review failure, found by grep.

| Token | Value | For |
|---|---|---|
| `desk` / `desk-deep` | `#EFEDE7` / `#E7E4DD` | the desk |
| `paper` / `surface` | `#FFFFFF` / `#FBFAF7` | paper; chrome |
| `border-hairline` | `#DDDAD3` | every 1px rule |
| `ink` / `ink-soft` | `#23262B` / `#6C7077` | type; quiet type |
| `greek` / `greek-dark` | `#DADCE0` / `#ADB1B8` | greeked bars — **the only two greeking values that exist** |
| `guide` / `guide-soft` | `#4A8FC9` / `#4A8FC94D` | **structure and affordance**: margins, columns, baselines, snap flashes, primary actions |
| `mark` / `mark-soft` | `#D64426` / `#D644261F` | **selection and human marks**: outlines, resize handles, annotations, destructive actions |
| `font-ui` | Inter (self-hosted) | UI type — never on paper |
| `font-serif-body` | Georgia | content type — **only** on paper |
| `text-micro` / `text-label` | 10px / 11px | chrome micro-type, never on paper |
| `tracking-caps` / `tracking-wordmark` | 0.1em / 0.14em | |
| `spacing-hit` / `radius-tool` / `shadow-paper` / `spacing-sheet` | 40px / 8px / … / 45vh | minimum hit target; tool radius; paper shadow; bottom sheet |

**Two inks and no others.** Greys carry hierarchy. A third accent is a review failure,
not a preference.

**Document geometry is never a class.** Millimetres and points are computed from the
model and applied as inline style. A frame at x = 62.5 mm has no Tailwind class and never
will; `left: 62.5 * scale` is the honest expression of it. Type size is
`ptToPx(sizePt, scale)`, inline.

`@/components/ui` is vendored shadcn: `Button`, `Input`, `Label`, `Separator`, `Slider`,
`Toaster`/`toast` (sonner), `Toggle`, `ToggleGroup`/`ToggleGroupItem`, `Tooltip`.
Restyle through tokens and variants only. Do not edit those files from a plugin — they
are outside your folder.

---

## 12. Keeping this file honest

`test/plugin-api-version.test.ts` extracts the sorted export list from
`src/kernel/index.ts`, hashes it, and compares against `kernel-api-hash` in this file's
frontmatter. Adding or removing a kernel export fails that test with a diff naming the
identifiers that changed.

When it fails: update the relevant section here, bump `kernel-api-version`, and paste the
new hash and count from the failure message into the frontmatter. Never edit the hash to
make the test pass without updating the prose — that is the exact rot the test exists to
prevent.

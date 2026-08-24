# MAQUETTE — PRD v3: Kernel & Extension Host

> **Supersedes** `MAQUETTE_PRD_SPEC.md` (v2). Visual language (§3) and stack decisions carry over; the architecture is restructured: Maquette is now an **extension host**, and every visible function — including the basics — is a plugin.
>
> **How to use:** fresh repo → copy old prototype to `reference/maquette.html` (interaction ground truth ONLY; its dark visuals are deprecated) → save this file as `SPEC.md` → instruct the implementer model: *"Execute SPEC.md, Lot 0 only."* Then proceed lot by lot, with a human test gate after Lot 1 and after every feature.
>
> **Model roles:** implementation is performed by less powerful models (Sonnet-class). A stronger model reviews against §6.4 and writes each feature's full spec from the descriptions in §7–§8. Therefore every lot in this document is a **self-contained work packet**: verbatim interfaces, fixed numeric points, explicit do-not-touch lists. An implementer must never need to infer architecture.

---

## 1. Product & research goal

**Maquette** is a two-layer page-design tool for printed material: a **flatplan** of greeked spreads for mass and rhythm, and a **spread editor** with guides, snapping, and numeric control.

**Boundary (hard):** Maquette does NOT lead to a press PDF. It produces the ~95% — structure, composition, pacing, refined intent — and final artwork is recreated in Scribus downstream. **Preflight, prepress checks, ink coverage, PDF/X, and press-quality export are permanently out of scope.** The only export is document JSON. A future Scribus bridge exists as horizon context (§9) and constrains nothing in this prototype.

**This prototype is a research probe.** Its success metric is what we learn about interaction modes for professional designers, not production utility. Exploratory or even "useless" features are legitimate deliverables when they test an interaction hypothesis. The playground arena and feature flags are central product surface, not side rooms.

## 2. Architecture: extension host

The base application is a **kernel** that provides only what plugins cannot provide for themselves. All visible functionality — flatplan, spread editor, inspector, block types, tools — ships as **built-in plugins** on the *same contract* as research probes.

**Kernel membership criterion** (settles all future arguments): something enters the kernel only if
(a) two plugins must share it to interoperate, or
(b) it defines the plugin contract itself, or
(c) it is a seam that must be swappable without breaking plugins.
Everything else is a plugin — including things that feel fundamental, like the inspector.

**Litmus test:** the kernel with zero plugins boots — empty shell, empty document, placeholder view — and compiles clean. Loading the five built-ins makes the application appear.

**Anti-overengineering rule:** the kernel API contains only what the five built-ins (§7) and nine probes (§8) demonstrably require. Nothing speculative. The kernel freezes after Lot 1 — the built-ins are the crash-test dummies that validate the contract before the freeze.

## 3. Visual language & stack (carried from v2, condensed)

**Daylight studio:** white paper is the brightest object, on a warm light-gray desk; near-white chrome with 1px hairlines; **two meaningful colors only** — non-photo blue (`guide`) for structure/affordance, red pencil (`mark`) for selection/human marks. UI type quiet (Inter); content type (Georgia) appears only on paper.

**Stack (decided, do not substitute):** Vite + React 18 + TS `strict` (no `any` in kernel) · pnpm · **Tailwind v4** + **shadcn/ui vendored** in `src/components/ui/` (restyle via tokens/variants only; map shadcn semantic vars → our tokens once in `tokens.css`; primary=guide, destructive=mark) · Zustand+immer · zod · `idb-keyval` · Vitest + Playwright · GitHub Actions (typecheck→test→build) · react-router · Vercel-ready (`vercel.json` committed; nothing deployed; local `pnpm dev` only).

**Tokens** — `src/styles/tokens.css`, the ONLY source of style values; arbitrary values (`bg-[#fff]`) are a review failure; document geometry (mm/pt) is inline style computed from the model, never a class:

```css
@import "tailwindcss";
@theme {
  --color-desk: #EFEDE7;         --color-desk-deep: #E7E4DD;
  --color-paper: #FFFFFF;        --color-surface: #FBFAF7;
  --color-border-hairline: #DDDAD3;
  --color-ink: #23262B;          --color-ink-soft: #6C7077;
  --color-greek: #DADCE0;        --color-greek-dark: #ADB1B8;
  --color-guide: #4A8FC9;        --color-guide-soft: #4A8FC94D;
  --color-mark: #D64426;         --color-mark-soft: #D644261F;
  --font-ui: "Inter", "Avenir Next", system-ui, sans-serif;
  --font-serif-body: Georgia, "Times New Roman", serif;
  --spacing-hit: 40px;           --radius-tool: 8px;
  --shadow-paper: 0 1px 2px rgb(35 38 43 / .08), 0 10px 28px rgb(35 38 43 / .10);
}
```

## 4. LOT 0 — the kernel (full specification)

### 4.1 Repository layout

```
maquette/
├── CLAUDE.md                    # §10, create verbatim
├── SPEC.md                      # this file
├── reference/maquette.html
├── docs/adr/                    # 001-kernel, 002-command-bus, 003-plugin-contract,
│                                # 004-job-seam, 005-visual-language
├── src/
│   ├── kernel/                  # FROZEN after Lot 1
│   │   ├── model/               # types.ts, schema.ts, reducers.ts, migrate.ts
│   │   ├── commands/            # bus.ts, history.ts, log.ts
│   │   ├── geometry/            # units.ts, snap.ts, grid.ts
│   │   ├── text/                # greek.ts, measure.ts        (seam)
│   │   ├── selection/           # selection store
│   │   ├── viewport/            # mm↔screen transform, zoom/pan state
│   │   ├── pointer/             # PointerEvent → spread-space mm normalization
│   │   ├── storage/             # StorageAdapter, IndexedDbAdapter, sidecar()
│   │   ├── jobs/                # JobExecutor, MockExecutor, ChangeSet (seam)
│   │   ├── registry/            # all registries + types
│   │   └── plugins/             # manifest types, loader, boundaries
│   ├── components/ui/           # shadcn — vendored
│   ├── shell/                   # chrome slots, canvas host, routes, flags
│   ├── plugins/                 # ALL features live here, built-in and probe
│   │   └── (empty in Lot 0)
│   └── styles/tokens.css
└── e2e/
```

### 4.2 Document kernel (`kernel/model`)

```ts
export interface Rect { x: number; y: number; w: number; h: number }   // mm
export interface BlockBase { id: string; type: string; frame: Rect }   // type = registry key
export interface TextAttrs { sizePt: number; leadingPt: number; align: 'left'|'justify'|'center' }
export type Block = BlockBase & Partial<TextAttrs> & Record<string, unknown>;
export interface Spread { id: string; cols: number; blocks: Block[] }
export interface PageSetup {
  wMm: number; hMm: number;                                            // default 210 × 280
  margins: { top: number; bottom: number; inside: number; outside: number }; // 18/24/15/13
  columnGutterMm: number;                                              // default 4
}
export interface DocumentV1 {
  schemaVersion: 1; id: string; title: string;
  updatedAt: number;                       // maintained by the bus
  page: PageSetup; spreads: Spread[];
}
```
zod schema validates on load; `migrate.ts` is identity for v1. The kernel has **no opinion** about block types — "body" is a plugin concept.

### 4.3 Command bus (`kernel/commands`) — the only door to mutation

```ts
export type Command =
  | { type: 'block/add';    spreadId: string; block: Block }
  | { type: 'block/update'; spreadId: string; blockId: string; patch: Partial<Block> }
  | { type: 'block/remove'; spreadId: string; blockId: string }
  | { type: 'spread/add' }
  | { type: 'spread/update'; spreadId: string; patch: Partial<Omit<Spread,'id'|'blocks'>> }
  | { type: 'doc/update';   patch: Partial<Omit<DocumentV1,'schemaVersion'|'id'|'spreads'>> };

export function dispatch(cmd: Command): void;   // validate → reduce (pure) → log → notify
export function undo(): void;  export function redo(): void;
export function getLog(): ReadonlyArray<{ ts: number; cmd: Command; source: string }>; // source = plugin id
export function subscribeDoc(cb: (doc: DocumentV1) => void): () => void;
```
Rules: reducers pure and unit-tested per command (incl. clamping to spread bounds, min block 14×8mm). Continuous gestures commit **one** command on gesture end. `source` records the dispatching plugin id (supplied by PluginContext).

### 4.4 Registries (`kernel/registry`)

```ts
export interface BlockTypeDef {
  id: string; label: string;
  createDefault(frame: Rect): Block;
  MiniView: React.FC<{ block: Block; scale: number }>;   // greeked, Layer 1
  FullView: React.FC<{ block: Block; scale: number }>;   // typographic, Layer 2
  Inspector?: React.FC<{ block: Block; spreadId: string }>;
}
export interface ToolDef {
  id: string; label: string; icon: React.ReactNode;
  layer: 'flatplan' | 'spread' | 'both';
  onDown?/onMove?/onUp?(e: { mm: {x:number;y:number}; spreadId: string; raw: PointerEvent }): void;
}
export interface OverlayDef {      // draws above paper in a canvas host layer
  id: string; layer: 'flatplan' | 'spread' | 'both'; zIndex: number;
  View: React.FC<{ spreadId: string; scale: number }>;
}
export interface PanelDef {        // docks into shell panel slot (right ≥760px / bottom sheet)
  id: string; title: string; order: number;
  View: React.FC; visible?: () => boolean;
}
export interface ViewDef { id: string; route: string; View: React.FC }  // e.g. /playground/x
```
Each registry: `register(def): Dispose`, `list()`, `subscribe()`. Duplicate id = hard error at load.

### 4.5 Plugin contract (`kernel/plugins`) — THE LAW

```ts
export interface MaquettePlugin {
  id: string;                       // folder name === id
  name: string; version: string;
  flag?: string;                    // if set, loads only when flag enabled
  register(ctx: PluginContext): Dispose | void;
}
export interface PluginContext {
  pluginId: string;
  registry: { blockTypes; tools; overlays; panels; views };   // register* fns
  bus: { dispatch(cmd: Command): void; getLog; subscribeDoc };  // dispatch stamps source=pluginId
  selection: SelectionApi;          // §4.6
  viewport: ViewportApi;            // §4.6
  storage: <T>(namespace: string) => SidecarStore<T>;          // §4.8 — namespaced to pluginId
  jobs: JobExecutor;                // §4.9
  text: TextApi;                    // greek(n), measure stub — §4.10
  flags: { get(name: string): boolean };
}
```
**Boundary rules (mechanically enforced via ESLint `no-restricted-imports` / boundaries config):**
1. A plugin lives entirely in `src/plugins/<id>/` with one entry `index.ts` exporting the manifest.
2. Plugins import ONLY from `kernel/*` public API, `components/ui`, `styles`, and their own folder. **Cross-plugin imports are a build error.**
3. Plugins never touch `localStorage`/IndexedDB directly — only `ctx.storage(ns)`.
4. Removing a plugin folder + its one line in the load list leaves the app compiling and running.
5. **Acceptance rule for every lot: adding the feature modifies zero files outside its folder** (except the one load-list line).
Loader: `shell/plugins.ts` holds an ordered list — built-ins, then probes; flag-gated entries skipped at load; each `register` wrapped in try/catch so a broken plugin disables itself with a visible toast, never a white screen.

### 4.6 Shared interaction primitives

```ts
export interface SelectionApi {   // kernel/selection
  get(): { blockIds: string[]; spreadId: string | null };
  set(sel): void; clear(): void; subscribe(cb): Dispose;
}
export interface ViewportApi {    // kernel/viewport — per spread-editor instance
  mmToScreen(p: {x,y}): {x,y};  screenToMm(p: {x,y}): {x,y};
  scale(): number;              // px per mm
  zoom(): number; setZoom(z: number, aroundScreenPt?): void;   // 0.5–4.0
  subscribe(cb): Dispose;
}
```
`kernel/pointer` converts raw pointer events on canvas surfaces into `{ mm, spreadId, raw }` before tools see them. In this prototype only mouse arrives; the contract already carries `raw` for future pen/touch.
`kernel/geometry`: mm↔pt↔px (`PT = 0.3528` mm/pt); coarse grid cell = pageW/6 × pageH/8; fine snap: x→column/gutter edges within **3mm**, y→baselines (every body leading from top margin) within **2mm**, else round to **1mm**. All pure, table-tested.

### 4.7 Canvas host (`shell`)

Renders paper geometry only: spread cards (Layer 1) and the spread stage (Layer 2) — white paper, `shadow-paper`, center gutter hairline — then mounts registered overlays by layer/zIndex and block Mini/Full views via the blockTypes registry. The host knows spreads have size; it does not know what is on them. Shell chrome: top bar (name, breadcrumb, undo/redo, env badge), bottom-center tool rail rendering the tools registry as a shadcn Toggle Group, panel dock rendering the panels registry.

### 4.8 Storage (`kernel/storage`)

```ts
export interface StorageAdapter {           // documents
  load(id): Promise<DocumentV1 | null>; save(doc): Promise<void>;
  list(): Promise<{id;title;updatedAt}[]>; remove(id): Promise<void>;
}
export interface SidecarStore<T> {          // plugin data — key prefix `${pluginId}:${ns}`
  get(key): Promise<T | null>; set(key, v: T): Promise<void>;
  list(prefix?): Promise<string[]>; remove(key): Promise<void>;
}
```
M0 adapter = IndexedDB. Autosave: any command debounces (500ms) `save()`. Plugin data NEVER goes inside `DocumentV1` — sidecars keep the schema stable while probes evolve.

### 4.9 Job seam (`kernel/jobs`) — shipped with a MOCK executor

Required by probes P6–P8 even though no built-in uses it.

```ts
export interface ChangeSet {
  id: string; label: string;
  groups: Array<{ id: string; label: string;          // intent-level grouping
                  commands: Command[] }>;
}
export interface JobRequest {
  kind: string; payload: unknown;
  scope: { spreadIds: string[]; lockedBlockIds?: string[] };   // displayed guarantee
}
export interface JobHandle {
  id: string;
  status(): 'queued'|'running'|'done'|'cancelled'|'failed';
  onProgress(cb: (pct: number, note?: string) => void): Dispose;
  onPartial(cb: (partial: ChangeSet) => void): Dispose;
  cancel(): void;
  result: Promise<ChangeSet>;
}
export interface JobExecutor { run(req: JobRequest): JobHandle }
```
`MockExecutor` (kernel-provided, deterministic): seeded artificial latency 2–8s, emits progress ticks and one partial ChangeSet midway, honors `cancel()` within 100ms, never emits commands touching `lockedBlockIds`, and implements two demo kinds (`'nudge-baselines'`, `'echo'`) so async UX is testable by humans without any real agent. ChangeSets are **applied only via** `applyChangeSet(cs, {acceptGroupIds})` in the kernel, which dispatches through the bus (undoable, logged).

### 4.10 Text seam (`kernel/text`)

`greek(nWords)` — deterministic pseudo-Latin. `measure(text, widthMm, attrs): { lines: number; overflow: boolean }` — v1 is a stated approximation (avg char width = 0.5 × sizePt in mm-equivalents); the seam exists so a real engine can replace it without plugin changes. **Fidelity honesty rule:** any surface showing measured text must render the kernel-provided `FidelityBadge` ("greeked" / "working proof") — Maquette never claims print truth.

### 4.11 Lot 0 acceptance

- Boots with the plugin list **empty**: shell, desk, empty document via seed, placeholder view, zero console errors.
- `pnpm typecheck && pnpm test` green: reducer tests per command, history tests, snap table tests, sidecar namespacing test, MockExecutor tests (progress, partial, cancel, lock respect), applyChangeSet round-trip (apply → undo).
- ESLint boundary config in place and violated-import fixture fails CI.
- CI + `vercel.json` committed; nothing deployed.

## 5. Work-packet shape (identical for every lot)

Every built-in and probe spec must contain exactly: **(1) Manifest** — id, folder, flag or none · **(2) Consumes** — kernel APIs used · **(3) Registers** — registry entries · **(4) Behavior** — fixed points, all numbers explicit · **(5) Keyspace** — sidecar namespaces or "none" · **(6) Acceptance** — automated checks + independence test (zero files modified outside folder) + removal test · **(7) Human test script** — numbered steps a person performs · **(8) Do-not-touch** — always includes `src/kernel`, `src/shell`, every other plugin folder.

## 6. Process

### 6.1 Lots and gates
- **Lot 0:** kernel (§4). Gate: §4.11 + strong-model review.
- **Lot 1:** five built-ins (§7), implemented one at a time in the listed order. Gate: the **human test** (§6.3) passes end-to-end. Kernel API may still be amended during Lot 1 *only* to satisfy a built-in's demonstrated need (each amendment = ADR). **Kernel freezes at Lot 1 completion.**
- **Lot 2+:** one probe (§8) per lot, any order, each behind a flag, each with its own spec (expanded from §8 by the spec-writing model using the packet shape §5), each human-tested before the next begins.

### 6.2 Spec-expansion rule (for the model writing feature specs)
Expand only the referenced probe description. Copy the packet shape §5. Every behavior number must be stated (no "reasonable defaults"). If a needed kernel API does not exist, the spec must say **"BLOCKED: requires kernel amendment"** and stop — never invent kernel changes.

### 6.3 Human test gate (Lot 1) — the minimum to test
A person with a mouse, no instructions beyond this script: 1) open app, see 3 seeded spreads in daylight palette · 2) draw a body block on spread 2's card (coarse snap) · 3) move it; delete it; undo twice (block returns, then move reverts) · 4) add a spread · 5) open spread 1; toggle baseline grid; zoom Ctrl+wheel to ~200%; pan · 6) draw a quote; drag it — observe column-edge snap flash; resize via red handle — observe baseline snap · 7) select body column; change leading via slider — baselines follow; set X to 15.0mm numerically · 8) switch columns 3→4 — guides update · 9) reload browser — everything persisted · 10) export JSON; import it back; confirm identical. Pass = all 10 without confusion or console errors.

### 6.4 Review protocol (strong model, every lot)
Check, in order: boundary compliance (imports, folder, load-list single line) · independence (git diff shows zero files outside folder) · removal test performed · all mutations via `ctx.bus.dispatch` (grep for store writes) · one command per gesture (log-length assertions exist) · token discipline (no arbitrary values; two-ink rule) · sidecar-only storage · packet completeness (§5, all 8 parts) · tests green. Reject with the specific rule number; no stylistic review.

## 7. LOT 1 — the five built-ins (concise packets)

Behavior ground truth for interaction: `reference/maquette.html`. Fixed numeric points repeated here are binding.

**B1 · `blocks-basic`** — Registers 4 block types. body: MiniView = light bars (`greek`), FullView = greek() text at sizePt/leadingPt (Georgia, justify/left/center), default 9.5/12pt; headline: dark bars / bold sans "The shape of the page", default 38/40pt; quote: mid bars / italic serif line between top+bottom rules, default 16/20pt; image: light box + diagonal X + "FPO" micro-caption, no text attrs. Each with Inspector fragment (size/leading sliders 6–72 / 7–80pt step 0.5; align toggle for body). Keyspace: none. Human test: all four render correctly in both layers.

**B2 · `tools-basic`** — Registers draw tools (one per block type; drag-create with ghost preview; coarse grid on flatplan, fine snap in spread; min one coarse cell / 14×8mm), move tool (drag body; snapped; clamped), delete (button + Backspace on selection). One command per completed gesture. Keyspace: none. Human test: §6.3 steps 2–3, 6.

**B3 · `flatplan`** — Registers the `/` view: spread cards at ≈0.55 px/mm (fit ≤520px), page numbers "pp. 2n–2n+1", "Open spread" → `/spread/:id`, add-spread card, greeked MiniViews, selection outline in `mark` red. Keyspace: none. Human test: §6.3 steps 1–4.

**B4 · `spread-editor`** — Registers the `/spread/:id` view + overlays: margin boxes (`guide-soft`), column guides for cols ∈ {1,2,3,4,6} with 4mm gutters (dashed), baseline-grid overlay (toggleable; every body leading from top margin), snap flash (matched guide flashes full `guide`), red resize handle (bottom-right, screen-px, ≥ `--spacing-hit`), zoom 50–400% Ctrl/Cmd+wheel around cursor + wheel/scrollbar pan + corner zoom chip with reset. Keyspace: `spread-editor:viewprefs` (zoom, toggles). Human test: §6.3 steps 5–6, 8.

**B5 · `inspector`** — Registers the dock panel: spread level (Columns toggle group 1/2/3/4/6; Baseline toggle; Snap toggle) and block level on selection (X/Y/W/H mm inputs, step 0.5, live apply, clamped; block type's Inspector fragment). Sliders preview live, commit one command on release. Empty state: "Select a frame to edit its geometry and type." Keyspace: none. Human test: §6.3 step 7.

## 8. LOT 2+ — the nine research probes (descriptions to be expanded per §6.2)

Priority order below = suggested, not binding. Every probe: own flag, own folder, own human test.

**P1 · `snapshot` — named moments + A/B compare.** Merge of ideas #13+#44, simplified: no tree, no merge. Pin the current document state with a label ("sent to editor"); restore any pin (as new commands, undoable). Hold exactly **two** pins as A/B: same-zoom flip with one key (Tab), acetate-overlay ghosting at 50%. Consumes: bus log, sidecar (`snapshot:pins` stores full DocumentV1 copies), overlays, panels. Hypothesis: designers compare two alternatives, not trees. Human test must show: pin → change → flip A/B at identical zoom → restore → undo restore.

**P2 · `copyflow` — real manuscript, real fit.** Paste actual text into a body chain across selected frames; `measure()` shows fill %, overflow badge per frame, and end-of-copy marker; edits to leading/size/frames update fit live; FidelityBadge always visible ("working proof"). Consumes: text seam, blockTypes (extends body via its own registered variant, NOT by editing B1), panels, sidecar (`copyflow:manuscripts`). Hypothesis: fit-truth changes decisions earlier than greeking. Human test: paste 800 words into 2 frames → see overflow → widen frame → overflow clears.

**P3 · `sketch` — sketch-to-maquette.** Freehand strokes on a flatplan card (mouse in this prototype); heuristic shape parse (closed rectangle-ish → image; horizontal zigzag → body; single heavy stroke → headline; ambiguous → chooser popover). Parsed blocks arrive as normal commands. Keep raw strokes in sidecar (`sketch:strokes`) for later study analysis. Hypothesis: drawing beats palette-then-drag for first-pass maquettes. Human test: sketch 3 shapes → correct typed blocks appear → undo removes all three as one gesture… (spec must fix grouping).

**P4 · `adhoc-tools` — instructions become buttons.** A small command-composer panel: record a parameterized micro-macro from inspector actions ("leading +0.5 on selection", "align selected to column 2"), name it, it appears on the tool rail scoped to current selection; stored in sidecar (`adhoc:tools`); replayable on any selection; each invocation = one log entry group. Hypothesis (DirectGPT): reuse of one-off intents is where direct manipulation beats chat. Human test: record → apply to another selection → undo as unit.

**P5 · `annotation` — anchored red pen.** Marks (box, ellipse, arrow, freehand ink, step-number auto-increment, text note) bound to `targetBlockId` when drawn over a block, else free-floating with mm frame; survive reflow by following the block; deleted target ⇒ mark moves to an **orphan tray**, never silently lost; open/resolved status; session grouping (round 1, round 2). Sidecar (`annotation:marks`, `annotation:sessions`); overlay + panel + tools registered for both layers. Hypothesis: anchored marks beat pixel marks for revision rounds. Human test: mark a quote → change leading (mark follows) → delete quote (mark in tray) → resolve a mark.

**P6 · `marks-execute` — a mark becomes an instruction.** On any annotation with a note, an explicit "Execute" affordance sends `{gesture, targetBlockId, note}` as a JobRequest to the executor (Mock in this prototype: `kind:'echo'` produces a plausible canned ChangeSet, e.g. nudge/resize of the target). Result arrives ONLY as a ChangeSet diff (P8 surface); never auto-applied; per-mark opt-in. Consumes: jobs, annotation's public sidecar data (read via its own copy — NO import from P5; spec must define the sidecar read contract). Hypothesis: the marked-up proof is a viable instruction channel. Human test: annotate → execute → review diff → accept one group, reject another → undo.

**P7 · `jobs-run` — interruptible execution.** A jobs panel + flatplan overlay: launch demo jobs (`nudge-baselines` on selected spreads with locked blocks chosen by selection), see progress on the affected spread cards (spatial status, not only a list), see the midway partial as a ghost, cancel mid-flight leaving state untouched. Hypothesis: visible scope + interruptibility are preconditions for delegation trust. Human test: launch → watch partial ghost → cancel → verify no change; relaunch → complete.

**P8 · `diff-review` — ChangeSets as reviewable diffs.** The shared result surface: ghost overlay of proposed state, changed frames outlined, before/after flip, accept/reject **per intent group** (never per micro-command), applied groups dispatch through `applyChangeSet` (undoable). Registered as overlay + panel; consumed by P6/P7 via the kernel ChangeSet type only. Hypothesis: diff-first is the acceptable form of agent output for professionals. Human test: receive a 2-group ChangeSet → accept group A only → undo → accept both.

**P9 · `constraint-mining` — the apprentice.** Passive observer of the command log; when a pattern repeats ≥3 times (v1 detectors, fixed list: pull-quote aligned to same column; consistent block-type leading; consistent image aspect snap), a quiet non-modal suggestion appears citing the three instances as thumbnails: "Promote to rule?" Accepted rules live in sidecar (`mining:rules`) and are enforced as an extra snap bias (never a hard block); dismiss = remember and stay silent for that pattern. Manners spec is binding: silent while composing, evidence always shown, one suggestion visible at a time. Hypothesis: emergent structure resolves Scout-vs-GenUI. Human test: perform a pattern 3× → suggestion with evidence → accept → feel the bias on next draw → dismiss another pattern → it never returns.

## 9. Horizon (context only, constrains nothing)
Real executor behind `JobExecutor` (LLM middleware → remote Scribus), stylus/touch/PWA, cloud StorageAdapter, real text engine behind `measure()`. None of it is scoped here.

## 10. CLAUDE.md — create verbatim at repo root

```md
# Rules for working on Maquette (read before ANY change)
1. Read SPEC.md and docs/adr/*.md first.
2. src/kernel and src/shell are FROZEN after Lot 1. During Lot 1, amendments
   only via demonstrated built-in need + ADR. Schema changes: version bump
   + migration + ADR + tests.
3. Every feature is a plugin in src/plugins/<id>/ with one manifest entry and
   one line in the load list. Adding a feature modifies ZERO files outside its
   folder. Cross-plugin imports are a build error. Removal must leave the app
   compiling.
4. All mutations via ctx.bus.dispatch. One command per completed gesture.
   Direct store or storage writes are bugs.
5. Plugin data lives in ctx.storage(ns) sidecars, NEVER inside DocumentV1.
6. Visual language: SPEC.md §3. tokens.css is the only source of style values;
   arbitrary values are forbidden; blue=structure, red=marks, nothing else
   carries color. Geometry (mm/pt) is inline style from the model, never a class.
7. src/components/ui (shadcn) is vendored: tokens/variants only.
8. reference/maquette.html = interaction ground truth; its visuals are deprecated.
9. Jobs: results arrive as ChangeSets via applyChangeSet only; never auto-apply;
   never touch lockedBlockIds.
10. No preflight, no prepress, no PDF/press export. Ever. JSON export only.
11. Keep typecheck, unit, boundary-lint and e2e green. New kernel logic = tests.
12. If a task needs a kernel API that does not exist: STOP, report BLOCKED.
    Never invent kernel changes. If a task conflicts with these rules, say so.
```

## 11. Resolved decisions
Extension host with frozen kernel after Lot 1 · five built-ins on the same contract as probes · mouse-only, local-only, Vercel-ready-not-deployed · shadcn/ui vendored on Tailwind v4, daylight-studio palette, two-ink rule · job seam with MockExecutor in kernel · sidecar storage for all plugin data · no press path, JSON export only · implementation by weaker models in self-contained packets, strong model reviews per §6.4 and expands probe specs per §6.2 · human test gate after Lot 1 and after every probe.

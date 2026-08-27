# Handover 003 — Implement B1 `blocks-basic`, then stamp the toolkit v1.0

Repo: `HotelIndiaCharlie/maquette` · Base: `dev` at `97e18e2` · Lot 1, built-in 1 of 5

You are the first session to build a Maquette plugin through the authoring toolkit. The
work packet is already written and every number in it is settled — **you should not have
to infer anything or ask anything.** If you do, that is a toolkit bug and fixing it is
part of this job (see §5).

---

## 1. Read first, in this order

1. `CLAUDE.md` — the 12 hard rules
2. `docs/packets/blocks-basic.md` — **YOUR SPEC.** Eight parts, every number stated
3. `docs/plugin-api.md` — the real kernel surface. **Anything not in it does not exist.**
   Trust it over `SPEC.md`; §0 lists the five places they deliberately differ
4. `src/plugins/example/` — a plugin guaranteed to compile against the real kernel
5. `SPEC.md` §7 (B1's paragraph) and §3 — context only; the packet already resolves them
6. `docs/adr/001`–`006`

Do **not** work from `SPEC.md` §4 for the kernel API. It is out of date in five
documented ways and you will both miss what exists and invent what doesn't.

---

## 2. Scope — B1 only

Register four block types — **body · headline · quote · image** — each with a greeked
Layer-1 `MiniView`, a typographic Layer-2 `FullView` and an Inspector fragment. Plus one
playground view so B1 is testable before B2/B3/B4 exist.

**Do not build B2 `tools-basic`.** A separate session takes it next. The packet's part 8
lists what is deliberately out of scope: no tools, no panels, no `/` route, no snapping.

---

## 3. Steps

### 3.1 Scaffold

```bash
pnpm new:plugin blocks-basic
```

This copies `src/plugins/example/`, renames throughout, and strips the teaching comments.
It leaves `docs/packets/blocks-basic.md` alone (it already exists — the script says so and
refuses to overwrite). It **deliberately does not touch `src/shell/plugins.ts`**; adding
that line is yours to do, consciously, because it is the line the independence rule is
about.

You get one file per registry:

```
BlocksBasicBlock.tsx   BlocksBasicTool.tsx    BlocksBasicOverlay.tsx
BlocksBasicPanel.tsx   BlocksBasicView.tsx    keyspace.ts
index.ts               blocks-basic.test.ts
```

**B1 uses two registries, not five.** Reshape to the file layout in packet part 1:

- **Delete** `BlocksBasicTool.tsx`, `BlocksBasicOverlay.tsx`, `BlocksBasicPanel.tsx`,
  `keyspace.ts` (B1's keyspace is **none**), and their registrations in `index.ts`
- **Split** `BlocksBasicBlock.tsx` into `BodyBlock.tsx`, `HeadlineBlock.tsx`,
  `QuoteBlock.tsx`, `ImageBlock.tsx`
- **Add** `constants.ts`, `GreekBars.tsx`, `TypeInspector.tsx`
- **Rename** `BlocksBasicView.tsx` → `PlaygroundView.tsx`

### 3.2 Implement, packet section by packet section

Keep `docs/plugin-api.md` open. **Every symbol you reach for should already be in packet
part 2 (Consumes).** Reaching for one that isn't means either the packet missed something
— add it and note it for §5 — or it does not exist, in which case write
`BLOCKED: requires kernel amendment` and stop. Never invent a kernel API (CLAUDE.md §12).

Put every number in `constants.ts` and import it in both the views and the tests. A
number written twice will disagree.

**Traps the packet calls out — re-read these before you write the views:**

- **Do not copy `MIN_LEGIBLE_PX` from `src/plugins/example/ExampleBlock.tsx`.** The example
  floors its bars to 1 px; B1 deliberately does not (packet §4.2). The example shows one
  legal choice, not B1's.
- **Do not add `--color-greek-mid` to `tokens.css`.** The quote's mid tone is
  `bg-greek-dark/60`, chosen precisely so B1 touches zero files in `src/styles/`.
- **The playground view is synthetic and read-only.** Build a `Spread` object in memory
  and pass it to `SpreadPaper`. It dispatches nothing and never touches the user's
  document. `BlockLayer` resolves views from the registry, not the document, so this works.
- **Inspector commit lives in B1's fragment**, not B5. `BlockTypeDef.Inspector` is
  `FC<{block, spreadId}>` with no callback slot, and `ctx.bus.transact` is synchronous, so
  a transaction cannot be held open across a drag. Slider readout previews live in local
  state; exactly one `block/update` on `onValueCommit`. Paper does not move until release
  — that is accepted, not a bug to fix.
- **No `FidelityBadge` anywhere.** B1 shows no measured value to a reader (packet §4.8).
- Register through `ctx.registry.*`, never the bare `blockTypes` export — the bare one
  leaks past unload.
- `ctx.bus.dispatch` stamps your plugin id. The bare `dispatch` stamps `'kernel'`.

Two items in the packet are marked **`[CALL]`** — decisions the packet author made rather
than escalating, with the alternative stated. Reverse either if you disagree; say so in
your commit message if you do.

### 3.3 Add the one load-list line

`src/shell/plugins.ts` — one import, one entry in `PLUGIN_LIST`. Nothing else in that
file, and nothing else in `src/shell/` at all.

### 3.4 Test

Write the tests packet part 6 names — including the **log-length assertion**: driving a
size slider through several intermediate values and one commit must append **exactly one**
entry to `getLog()`, with `source === 'blocks-basic'`. That assertion is how CLAUDE.md §4
is enforced; it is not optional.

### 3.5 Gate

```bash
pnpm typecheck && pnpm lint && pnpm lint:boundaries && pnpm test && pnpm build && pnpm e2e
pnpm verify:plugin blocks-basic --base 97e18e2
```

**`--base 97e18e2` matters.** Without it the toolkit's own commits on `dev` show up as
rule-5 strays and the independence check fails for the wrong reason.

Baseline before you start: 203 unit tests, 5 e2e, all green.

### 3.6 Run the human test script yourself

Packet part 7, nine numbered steps, in a real browser with `pnpm dev` and
`PLUGIN_LIST = [blocksBasic]`. Any step you cannot perform as written is a **packet bug**
— fix the packet, not just the code, and note it for §5.

---

## 4. Definition of done

- [ ] Four block types registered; all four render in both layers on the playground
- [ ] Zero kernel "unknown block type" placeholders — every type resolves
- [ ] One view at `/playground/blocks-basic`; `/` still shows the shell placeholder
- [ ] `git diff` shows nothing outside `src/plugins/blocks-basic/` except one line in
      `src/shell/plugins.ts` and the packet/handover docs
- [ ] `src/styles/tokens.css`, `src/kernel/**` and the rest of `src/shell/**` untouched
- [ ] Zero console errors **and zero warnings** at boot
- [ ] Full gate green, both `verify:plugin` checks pass
- [ ] Human test script performed, all nine steps

---

## 5. Then: stamp the toolkit v1.0 — this is part of the job, not a nicety

The toolkit is at **v0.2** because no line of a real plugin had been written through it.
You are the first to do that, so you are the only one who can stamp it honestly. This is
decision D2 in `docs/handover/002-plugin-authoring-toolkit.md` and it is the reason B1 was
sequenced ahead of B2.

Keep a running note **while you implement** — retrofitting it afterwards produces a list
of what you remember, not what actually hurt:

- every blank `docs/templates/plugin-packet.md` failed to elicit
- every kernel API `docs/plugin-api.md` failed to surface, or surfaced misleadingly
- every question `docs/plugin-authoring.md` should have told the interviewer to ask
- every place `pnpm new:plugin` scaffolded something you had to undo
- every packet number that turned out to be wrong, unbuildable, or ambiguous in practice

Then:

1. Amend `docs/templates/plugin-packet.md` → `packet-template-version: 1.0`
2. Amend `docs/plugin-authoring.md` → `protocol-version: 1.0`
3. Amend `docs/plugin-api.md` if the kernel surprised you. **If you changed
   `src/kernel/index.ts` at all, `test/plugin-api-version.test.ts` will fail and tell you
   the new hash and count** — update the prose, then the frontmatter, in that order
4. Record the amendments in `docs/adr/006-plugin-authoring-toolkit.md` under a new
   "Amendments from implementing B1" heading, alongside the existing v0.2 section
5. Consider whether `src/plugins/example/` should change. It is the thing every future
   session copies; if it taught you something wrong, fix it there

**The v0.2 → v1.0 diff is the real deliverable of this handover.** B1 is four block types;
the toolkit is what nine more plugins depend on.

---

## 6. Standing constraints

- All mutations via `ctx.bus.dispatch`; one command per completed gesture
- Plugin data in `ctx.storage(ns)` sidecars, never in `DocumentV1` — B1's keyspace is
  **none**, so it calls `ctx.storage` not at all
- Tokens only; no arbitrary values; two inks (`guide` = structure, `mark` = marks)
- Document geometry is inline style from the model, never a class
- `src/kernel/**` and `src/shell/**` are do-not-touch beyond the one load-list line. A
  kernel amendment during Lot 1 needs a demonstrated need **and** a new ADR — otherwise
  write `BLOCKED: requires kernel amendment` and stop
- **Do not open a PR** unless asked; the human creates them from the Claude Code UI

## 7. What comes after

B2 `tools-basic` — draw/move/delete tools, one command per gesture. A separate session,
working from a packet produced with the toolkit **you** stamped v1.0. Do not start it.

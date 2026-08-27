---
title: Writing a Maquette plugin — the authoring protocol
protocol-version: 1.0
audience: an LLM session, working with a human, that will produce and then implement a §5 work packet
---

# How a Maquette plugin gets written

This is the single source of truth for the process. `.claude/skills/plugin-packet/` is a
pointer to this file; the file itself is deliberately paste-able into any other model.

**The three artefacts you work with:**

| File | What it is |
|---|---|
| `docs/plugin-api.md` | The real kernel surface. **Read it before you write a line.** Anything not in it does not exist. |
| `docs/templates/plugin-packet.md` | The blank SPEC.md §5 packet. Eight parts, no more. |
| `src/plugins/example/` | A plugin that is guaranteed to compile against the real kernel. Copy its shapes, not its content. |

**Three phases: Interrogate → Emit → Implement.** They are strictly ordered. Do not start
writing code while blanks remain; do not start filling blanks before you have read
`docs/plugin-api.md`.

---

## The standing constraints

These hold for every plugin, are not negotiable, and do not need re-deciding per packet.
State them once to the human if they seem unaware; otherwise just obey them.

1. **All mutations go through `ctx.bus.dispatch`.** Direct store or storage writes are
   bugs (CLAUDE.md §4). There is no other door.
2. **One command per completed gesture.** A drag previews in local component state and
   commits once on pointer-up. When one gesture genuinely needs several commands, wrap
   them in `ctx.bus.transact(label, fn)` — one undo step, one log group. Prove it with a
   log-length assertion in a test.
3. **Plugin data lives in `ctx.storage(ns)` sidecars, never inside `DocumentV1`**
   (CLAUDE.md §5). The single exception is data that *is* the block: extra keys on your
   own block type, which `blockSchema` preserves.
4. **Tokens only.** `src/styles/tokens.css` is the only source of style values. An
   arbitrary Tailwind value (`bg-[#fff]`, `text-[13px]`) is a review failure. **Two inks
   only** — `guide` blue for structure and affordance, `mark` red for selection and human
   marks. Greys carry hierarchy. A third accent is a review failure, not a preference.
5. **Document geometry is inline style computed from the model, never a class.**
   `left: block.frame.x * scale`, `fontSize: ptToPx(sizePt, scale)`. A frame at 62.5 mm
   has no Tailwind class and never will.
6. **A plugin lives entirely in `src/plugins/<id>/`,** folder name === id. It imports only
   `@/kernel`, `@/components/ui`, `@/styles` and its own folder. Adding it modifies zero
   files outside that folder except one line in `src/shell/plugins.ts`.
7. **If a needed kernel API does not exist: write `BLOCKED: requires kernel amendment`
   and stop.** Never invent one (CLAUDE.md §12).

---

## Phase 1 — Interrogate

**You have a rough idea and a human. Your job is to leave with no blank that requires
inference.** The §5 packet shape is not a form to fill politely; it is a list of the
things that, left unsaid, get built wrong.

### How to run it

- **Batch questions.** Three to six at a time, grouped by topic, each with the options
  you actually see. A one-question-at-a-time interrogation exhausts the human before you
  reach the parts they most need to decide.
- **Put the constraint in the question, not just the options.** A question that opens
  "`BlockTypeDef.Inspector` is `FC<{block, spreadId}>` — no callback slot — and
  `ctx.bus.transact` is synchronous, so a transaction cannot be held open across a drag"
  gets a decision. The same question without that preamble gets a preference, and the
  preference is often impossible. Do the API reading *before* you ask.
- **Compute the numbers before you offer them.** "A 7 pt caption is 1.36 px at flatplan
  scale" is a decidable fact; "the caption might be small" is not. Run the arithmetic and
  put the result in the option text.
- **Propose, don't ask open-endedly.** "How many bars?" gets a shrug. "Bars derived from
  leading, so a 12 pt leading gives one bar per 4.23 mm — or a fixed 6 bars regardless of
  frame height. Which?" gets a decision. Give your recommendation and say why.
- **Do not stop at the first plausible answer.** Every answer opens branches. "Derived
  from leading" immediately raises: what happens at flatplan scale where that is 2.3 px?
  Resolve the branch before moving on.
- **Say when the source is binding.** If SPEC.md fixes a number, quote it and move on —
  do not re-open it. Spend the human's attention only on what is genuinely open.
- **Write the answer down in the packet as you get it,** in the human's own numbers.

### What is already decided — do not re-ask

Before interviewing, separate the binding from the open:

- **SPEC.md §7 / §8** fixes numbers per plugin. Those are binding.
- **CLAUDE.md's 12 rules** and the standing constraints above. Binding.
- **`docs/plugin-api.md`** fixes what exists. Binding.
- Everything else is open, and every open thing is your job.

### The ten things packets most often get wrong

Push hardest here. These are in rough order of how much rework they cause. Items 9 and 10
were added after the first live run of this protocol (B1 `blocks-basic`), where both were
missed by the template and only surfaced because the interview kept going.

1. **Numbers that were never stated.** Sweep the whole idea for adjectives — "small",
   "subtle", "a few", "appropriate", "roughly". Every one is an unasked question. SPEC.md
   §6.2: *every behaviour number must be stated; no "reasonable defaults".*
2. **Behaviour across `scale`.** Every `MiniView`, `FullView` and overlay receives a
   `scale` prop in px per mm. The flatplan runs at ≈0.55; the editor runs at
   `viewport.scale()`, which zoom moves between 0.5× and 4× the fit scale. **Ask what
   each rendered element does at both ends.** A 1 mm rule is 0.55 px on a flatplan card —
   invisible or aliased. A caption at 6 pt is sub-pixel. Decide per element: hide below a
   stated threshold, floor to a stated minimum px, or accept it. This is the single most
   common source of "it looked fine in the editor" bugs.
3. **The sidecar keyspace.** Namespace, key, value shape, when written, when read. "We
   might persist something later" means the answer is "none" today. If the plugin reads
   **another plugin's** data: there is **no import allowed**, and `ctx.storage` is
   prefixed to your own id, so another plugin's sidecar is not reachable. Spell the read
   contract out in full. If it needs a mechanism that does not exist, that is `BLOCKED`.
4. **Commit semantics.** For every continuous control — a slider, a drag, a numeric field
   — ask: what does the user see *during*, and what reaches the bus *at the end*? The
   answers are usually "local state, live preview" and "one command on release". Say so
   explicitly, and say which side owns it when two plugins are involved (the control's
   host, or the fragment it renders).
5. **The fidelity badge.** SPEC.md §4.10: *any surface showing measured text must render
   `FidelityBadge`.* Ask directly: does this surface show anything derived from
   `measure()` — a fill %, an overflow state, a line count? Rendering greeked shapes at a
   size is **not** measuring. Get a yes or a no, in the packet, with the reason.
6. **Tokens that do not exist.** If the design names a colour, check it against
   `tokens.css`. `--color-greek` and `--color-greek-dark` are the only greeking values
   that exist. A new token is a change to `src/styles/`, which is **outside the plugin
   folder** — so it is a packet-level decision requiring explicit agreement, never a
   silent addition. Offer the alternatives: reuse an existing token, derive with opacity,
   or amend `tokens.css` as an agreed exception.
7. **The human test script.** Not "check it works". Numbered steps, each an action and an
   observable result, performable by a person with a mouse and nothing else. Write it
   *during* the interview — the act of writing step 4 usually reveals that step 3's
   behaviour was never decided.
8. **What the plugin does *not* do.** The boundary with the next plugin. B1 owns the
   Inspector *fragment*; B5 owns the panel that hosts it. Getting this wrong builds the
   same thing twice or neither time.
9. **Whether the plugin can be seen at all, on its own.** Ask early, before designing
   anything: *with `PLUGIN_LIST` containing only this plugin, what does a person see?*
   Built-ins are implemented in order, so an early one depends on views, tools and panels
   that do not exist yet. B1 registers four block types and — until B2, B3 and B4 land —
   nothing can draw one, nothing routes to a page showing one, and the shell falls
   through to the placeholder. Its §7 human test was literally unperformable. The fix is
   usually one playground view the plugin registers for itself (SPEC.md §1: the playground
   arena is "central product surface, not side rooms"), and that view must be **synthetic
   and read-only** — build a `Spread` object in memory, pass it to `SpreadPaper`,
   dispatch nothing. A plugin that seeds the real document at load time to make itself
   visible is a worse bug than the one it fixes.
10. **Where the spec contradicts itself.** SPEC.md §7 fixes a plugin's behaviour; SPEC.md
   §3 and `tokens.css` fix the visual language; they do not always agree. B1 alone had
   two: §7 puts a *bold sans* headline on paper where §3 keeps UI type off it, and asks
   for a *micro-caption* on paper where the micro-type tokens say "never used on paper".
   Both are real, both are resolvable, and both get silently resolved — differently each
   time — if the packet does not name them. Read the plugin's §7 paragraph word by word
   against §3 and `tokens.css`, and record every clash with the winner and the reason.

### Ending the interview

You are done when you can read the packet top to bottom and, at every number, name the
human sentence it came from. If any number traces back to you, ask.

---

## Phase 2 — Emit

Copy `docs/templates/plugin-packet.md` to `docs/packets/<plugin-id>.md` and fill it.

- **All eight parts. No more, no fewer.** Manifest · Consumes · Registers · Behavior ·
  Keyspace · Acceptance · Human test script · Do-not-touch.
- **Delete the template's instruction blockquote** and the per-section italics as you
  fill them. Leave the section headings.
- Write "none" where a section does not apply. Do not delete the section — an explicit
  "none" is evidence it was considered; an absent section is evidence it was forgotten.
- Cross-check *Consumes* against `docs/plugin-api.md` symbol by symbol. Anything not in
  that doc is a `BLOCKED` entry, not a hopeful import.
- Read part 4 back once, hunting adjectives. Any that survive are unfinished interviews.
- **Eight parts, not nine.** SPEC.md §5 says *exactly* those eight. Material that wants
  its own section — spec conflicts, open questions — goes inside part 4, not after part 8.
- **Mark anything you decided yourself.** Where you made a call rather than asking, say so
  in place (`[CALL]`) with the reasoning and the alternative. The implementing session can
  then reverse it without re-deriving why it exists, and a reviewer can see the difference
  between a decision and an assumption.
- **Say what is deliberately not testable this lot,** and what covers it in the meantime.
  Otherwise the implementer reads a missing check as a missing feature.

Show the human the filled packet before implementing. It is faster to be wrong on this
page than in the code.

---

## Phase 3 — Implement & verify

```bash
pnpm new:plugin <id>     # scaffolds src/plugins/<id>/ from src/plugins/example/
```

The scaffold deliberately **does not** touch `src/shell/plugins.ts`. Adding that one line
stays a conscious act — it is the line the acceptance rule is about.

Then:

1. **Implement**, packet section by packet section, `docs/plugin-api.md` open. Every
   symbol you reach for should already be in *Consumes*. Reaching for one that isn't
   means the interview missed something: go back and add it to the packet, or find that
   it does not exist and stop.
2. **Add the load-list line** — one import, one entry in `PLUGIN_LIST`.
3. **Write the tests the packet's part 6 named**, including the log-length assertion.
4. **Run the gate:**
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
   ```
5. **Run the independence and removal checks:**
   ```bash
   pnpm verify:plugin <id> --base <the commit you started this plugin from>
   ```
   Pass `--base` explicitly, pointing at your own session's actual starting commit —
   **not** a SHA copied from an earlier handover. A hardcoded SHA is only valid until the
   next toolkit or docs commit lands on the same branch, which can happen before the
   plugin session that was told to use it even starts (found running B1's own handover
   instructions verbatim: `docs/adr/006`).
6. **Run the human test script yourself,** step by step, in a browser. Steps that cannot
   be performed as written are packet bugs — fix the packet, not just the code.
7. **Amend this protocol from what hurt.** Every blank the template failed to elicit,
   every kernel API `docs/plugin-api.md` failed to surface, every question this file
   should have told you to ask. That amendment is part of the job, not a nicety.

### Things that will bite

- `pnpm new:plugin` refuses an id that fails `PLUGIN_ID_PATTERN` or whose folder exists.
  The pattern has **no leading underscore and no double underscore** — `_example` and
  `__template__` are both invalid ids.
- Register through **`ctx.registry.*`**, never the bare `blockTypes` / `tools` exports.
  The bare ones are for the shell and for tests; registering on them leaks past unload.
- `ctx.bus.dispatch` stamps your plugin id on the log. The bare `dispatch` export stamps
  `'kernel'` and destroys attribution.
- Sidecar reads are `Promise`s. Render a default first, update when it resolves. There is
  no synchronous read.
- Your Mini/Full views render inside a box the `BlockLayer` has already sized, positioned
  and set to `overflow: hidden`. Fill it (`size-full`); do not position yourself.
- The `example` plugin is **never** in `PLUGIN_LIST`. Do not "fix" that omission.
- **Testing an Inspector, overlay, or panel that renders a vendored Radix control** (any
  `@/components/ui/*` that measures its own size, or that supports pointer-driven drag —
  `slider` is the one found so far): jsdom implements neither `ResizeObserver` nor pointer
  capture. Rendering one in a vitest test throws `ResizeObserver is not defined` at mount,
  and dragging one throws `target.hasPointerCapture is not a function` on the first
  `pointerdown`. Both are stubbed globally in `test/setup.ts` — you do not need to
  reproduce the workaround, but a real gesture test still needs its own
  `Element.prototype.getBoundingClientRect` stub (jsdom returns all-zero rects, and Radix's
  slider computes its value from pointer position against that rect) and
  `IS_REACT_ACT_ENVIRONMENT = true` before rendering. See
  `src/plugins/blocks-basic/blocks-basic.test.tsx` for a worked example of driving a real
  drag-then-release gesture and asserting the resulting log length.
- **A no-op commit is usually unreachable through the real widget, not just discouraged.**
  Radix's `Slider` already suppresses `onValueCommit` internally when a drag nets back to
  its start value, so a packet's "a commit equal to the current value dispatches nothing"
  rule is defense-in-depth you cannot prove by driving the slider back to where it started
  — nothing fires either way. Test the guard as a small pure function instead (see
  `resolveCommit` in `src/plugins/blocks-basic/TypeInspector.tsx`), not through the widget.

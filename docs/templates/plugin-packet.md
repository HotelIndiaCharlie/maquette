---
packet-template-version: 0.1
shape: SPEC.md §5 — exactly eight parts, no more
---

# Work packet — `<plugin-id>`

> **How to use this file.** Copy it to `docs/packets/<plugin-id>.md` and fill every
> blank. The session that implements this plugin gets *only* this packet plus
> `docs/plugin-api.md` — it cannot ask you a question. A blank left vague becomes a
> guess, and a guess becomes a rewrite.
>
> **Two rules from SPEC.md §6.2 that this template exists to enforce:**
>
> 1. **Every behaviour number is stated explicitly.** "Reasonable defaults", "sensible
>    spacing", "an appropriate size" are all failures. If you cannot state the number,
>    you have not finished interviewing (`docs/plugin-authoring.md`).
> 2. **If a needed kernel API does not exist, write `BLOCKED: requires kernel amendment`
>    and stop.** Never invent one. `src/kernel/**` and `src/shell/**` are do-not-touch.
>    During Lot 1 an amendment is possible with a demonstrated need and a new ADR — but
>    that is a human decision recorded here, not a silent edit.
>
> Delete this blockquote when the packet is filled.

---

## 1. Manifest

*Complete when: the folder is fully determined and someone could create it without
asking anything.*

| Field | Value |
|---|---|
| `id` | `<kebab-case, matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`>` |
| Folder | `src/plugins/<id>/` (folder name **is** the id) |
| `name` | `<human label>` |
| `version` | `0.1.0` |
| `flag` | `<flag name>` — probes are flagged; **built-ins are unflagged: write "none"** |
| Load-list line | `src/shell/plugins.ts` — the import plus one entry in `PLUGIN_LIST` |
| File layout | *list every file you expect to create, with one line each on what it holds* |

---

## 2. Consumes

*Complete when: every kernel symbol the implementation will touch is named, and nothing
is named that isn't in `docs/plugin-api.md`.*

| Kernel export | Used for |
|---|---|
| | |

**Other plugins' data read:** *"none", or spell out the read contract in full — what is
read, from where, and by what mechanism. **There is no import allowed.** A sidecar
belonging to another plugin is not reachable through `ctx.storage`. If the answer needs a
mechanism that does not exist, this is where you write `BLOCKED`.*

**UI primitives used** (`@/components/ui`): *list them, or "none".*

**Kernel APIs needed that do not exist:** *"none", or a `BLOCKED: requires kernel
amendment` entry per missing API, each with the demonstrated need.*

---

## 3. Registers

*Complete when: every registry entry has an id, and every id is unique across the app.*

| Registry | id | Notes |
|---|---|---|
| `blockTypes` | | |
| `tools` | | |
| `overlays` | | `layer`, `zIndex` |
| `panels` | | `title`, `order` |
| `views` | | `route` |

*Write "none" against a registry you do not touch. Do not delete the row — an empty row
is evidence you considered it.*

---

## 4. Behavior — every number stated

*Complete when: an implementer never has to choose a value. Read this section back
asking "could two competent people build different things from this?" — if yes, it is
not done.*

### 4.1 Defaults

*Every default value the plugin creates or assumes. For a block type: exactly what
`createDefault(frame)` returns, field by field, including `id` and `type`.*

### 4.2 Rendering

*What is drawn, at what size, in what colour token, at what spacing. Both layers if the
plugin renders in both. State how each surface responds to the `scale` prop — flatplan
scale is ≈0.55 px/mm and editor scale is `viewport.scale()` (0.5–4.0 × base), so a value
that is fine at one is often sub-pixel at the other.*

### 4.3 Degradation at small scale

*What happens when a rendered element falls below ~1 px. Hide it, floor it, or accept
it — but say which, per element. "It'll be fine" is not an answer.*

### 4.4 Interaction

*Every gesture, with its command(s). Name the exact `Command` objects dispatched. State
where `ctx.bus.transact` is used and what its label is. One command per completed
gesture — say what "completed" means for each gesture here.*

### 4.5 Bounds and validation

*Ranges, steps, minimums, what clamps and what refuses. Numbers, not adjectives.*

### 4.6 Fidelity

*Does any surface show **measured** text — anything derived from `measure()` shown to
the reader (a fill %, an overflow state, a line count)? If yes, `FidelityBadge` is
mandatory (SPEC.md §4.10): say where it renders. If no, say so explicitly and say why —
this is the question packets most often skip.*

---

## 5. Keyspace

*Complete when: every sidecar namespace and key is named with its value shape — or the
word "none".*

| `ctx.storage(ns)` | Key | Value shape | Written when | Read when |
|---|---|---|---|---|

*Plugin data lives in `ctx.storage(ns)` sidecars, **never** inside `DocumentV1`
(CLAUDE.md §5). The one exception: data that **is** the block — extra keys on your own
block type, which `blockSchema` preserves. If you use that exception, list those keys
here too and say why they are block data rather than sidecar data.*

---

## 6. Acceptance

*Complete when: every line is a command someone can run, or an assertion someone can
check.*

**Automated**

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`
- [ ] Unit tests: *list them — one per behaviour number that could regress*
- [ ] Log-length assertion proving **one command per completed gesture**
- [ ] *e2e assertions, if this plugin renders something a person sees*

**Independence** (SPEC.md §4.5 rule 5)

- [ ] `pnpm verify:plugin <id>` passes — `git diff --name-only` shows nothing outside
      `src/plugins/<id>/` except the one line in `src/shell/plugins.ts`

**Removal** (SPEC.md §4.5 rule 4)

- [ ] `pnpm verify:plugin <id>` removal check passes — folder and load-list line deleted
      in a scratch copy, `pnpm typecheck` still green, then restored

**Boot**

- [ ] With `PLUGIN_LIST` containing only this plugin: *state exactly what must be visible*
- [ ] Zero console errors and zero console warnings

---

## 7. Human test script

*Complete when: a person with a mouse and no other instructions can follow it. Numbered
steps, each an action and an observable result. Not "check it works".*

1.
2.
3.

---

## 8. Do-not-touch

Constant part — true for every plugin, do not edit:

- `src/kernel/**` — frozen; amendment needs a demonstrated need and a new ADR (CLAUDE.md §2)
- `src/shell/**` — except the **single** load-list line in `src/shell/plugins.ts`
- Every other `src/plugins/<other-id>/` folder — cross-plugin imports are a build error
- `src/components/ui/**` — vendored shadcn; tokens and variants only
- `src/styles/tokens.css` — the only source of style values; **a new token is a change
  outside your folder and must be agreed in this packet, not made silently**

Packet-specific additions:

-

---
name: plugin-packet
description: Turn a rough Maquette plugin idea into a filled SPEC.md §5 work packet, then implement it. Use when the user describes a new Maquette plugin, block type, tool, overlay, panel or research probe; asks for a work packet or plugin spec; asks how to write a Maquette plugin; or asks what the kernel API offers a plugin.
---

# Maquette plugin packet

The protocol lives in **`docs/plugin-authoring.md`**. Read it now, in full, and follow
it. It is kept as one portable file so it works outside Claude Code too; this skill only
routes you to it.

Read in this order:

1. `docs/plugin-authoring.md` — the three phases: Interrogate → Emit → Implement
2. `docs/plugin-api.md` — the real kernel surface. **Anything not in it does not exist.**
3. `docs/templates/plugin-packet.md` — the blank eight-part packet
4. `src/plugins/example/` — a plugin guaranteed to compile against the real kernel
5. `CLAUDE.md` — the 12 hard rules

Two things to get right before anything else:

- **Phase 1 is an interrogation, not a form.** Batch questions, propose concrete options
  with numbers, and do not stop at the first plausible answer. Every adjective in the
  human's description ("small", "subtle", "a few") is an unasked question.
- **Never invent a kernel API.** If the plugin needs one that is not in
  `docs/plugin-api.md`, write `BLOCKED: requires kernel amendment` in the packet and stop
  (CLAUDE.md §12).

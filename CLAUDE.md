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

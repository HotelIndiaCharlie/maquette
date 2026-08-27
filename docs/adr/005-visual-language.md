# ADR-005 — Daylight studio, two inks, one source of values

- Status: accepted (Lot 0)
- Carried from `MAQUETTE_PRD_SPEC.md` (v2) §3, restated for the kernel repo

## Context

The v2 prototype (`reference/maquette.html`) is a dark studio: grey desk, warm
stock, chip-coloured chrome. Its *interactions* are ground truth and are being
ported faithfully. Its *visuals* are deprecated.

## Decision

**Daylight studio.** White paper is the brightest object in the frame, on a warm
light-grey desk (`--color-desk: #EFEDE7`). Chrome is near-white with 1px
hairlines. Content type (Georgia) appears only on paper; UI type (Inter) stays
quiet and off it.

**Two inks, and no others.**

- `--color-guide` (non-photo blue) — structure and affordance: margins, columns,
  baselines, snap flashes, primary actions.
- `--color-mark` (red pencil) — selection and human marks: outlines, resize
  handles, annotations, destructive actions.

Greys carry hierarchy. Nothing else carries colour. A third accent is a review
failure, not a preference.

**`src/styles/tokens.css` is the only source of style values.** Arbitrary
Tailwind values (`bg-[#fff]`, `text-[13px]`) are a review failure. shadcn's
semantic variables are mapped onto our tokens exactly once, in that file, via
`@theme inline`: `primary = guide`, `destructive = mark`. Vendored components in
`src/components/ui` are restyled through tokens and variants only.

**Document geometry is never a class.** Millimetres and points are computed from
the model and applied as inline style. A frame at x = 62.5 mm has no Tailwind
class and never will; `left: 62.5 * scale` is the honest expression of it.

**Inter is self-hosted** (`@fontsource-variable/inter`). No external font
request, so the app works offline and the Lot 0 "zero console errors" boot gate
stays strict rather than tolerating network noise.

## Consequences

Reviewers check token discipline by grep: any `[#`, any `[0-9]+px]` inside a
className is a finding. The two-ink rule is checked the same way — a colour that
is neither a token nor a grey does not belong.

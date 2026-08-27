/**
 * An overlay — SPEC.md §4.4, §4.7. Drawn ABOVE paper by the kernel's
 * OverlayLayer, which sizes it to the paper and sets `pointer-events-none`.
 *
 * Guides are `guide` blue: structure and affordance. Selection and human marks
 * are `mark` red. Those are the only two inks; greys carry hierarchy, and a
 * third accent is a review failure (ADR-005).
 */
import type { OverlayDef } from '@/kernel';
import { marginBoxes, useDocument } from '@/kernel';

export const ExampleOverlay: OverlayDef['View'] = ({ scale }) => {
  // The React way to read the document: re-renders on every change, no manual
  // subscription to leak. `ctx.bus.subscribeDoc` is the imperative equivalent,
  // for code outside React.
  const { page } = useDocument();

  return (
    <>
      {marginBoxes(page).map((box, i) => (
        <div
          key={i}
          // Colour is a token class; GEOMETRY is inline style computed from the
          // model. A box at x = 13 mm has no Tailwind class and never will —
          // `left: 13 * scale` is the honest expression of it (ADR-005).
          className="absolute border border-guide-soft"
          style={{
            left: box.x * scale,
            top: box.y * scale,
            width: box.w * scale,
            height: box.h * scale,
          }}
        />
      ))}
    </>
  );
};

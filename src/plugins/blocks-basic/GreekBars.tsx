/**
 * The shared MiniView bar renderer — packet §4.2. All three text types
 * (body, headline, quote) share this renderer, parameterised by `tone`.
 * Image is different (§4.5, ImageBlock.tsx).
 */
import { ptToPx } from '@/kernel';

export type GreekTone = 'light' | 'dark' | 'mid';

/**
 * `bg-greek-dark/60` is an opacity modifier on a real token, not a new one —
 * quote's mid tone deliberately stays out of tokens.css (packet §4.2).
 */
const TONE_CLASS: Record<GreekTone, string> = {
  light: 'bg-greek',
  dark: 'bg-greek-dark',
  mid: 'bg-greek-dark/60',
};

export interface GreekBarsProps {
  leadingPt: number;
  frameHeightMm: number;
  scale: number;
  tone: GreekTone;
}

/**
 * Bar thickness has NO floor (packet §4.2) — sub-pixel bars are allowed to
 * alias or vanish; the flatplan tells the truth about scale. `rows` keeps a
 * `max(1, …)` floor of its own: a row count of 0 would make a whole block
 * invisible, which is a different failure than a thin bar ([CALL], §4.2).
 */
export function GreekBars({ leadingPt, frameHeightMm, scale, tone }: GreekBarsProps) {
  const pitchPx = ptToPx(leadingPt, scale);
  const barPx = pitchPx * 0.5;
  const rows = pitchPx > 0 ? Math.max(1, Math.floor((frameHeightMm * scale) / pitchPx)) : 1;

  return (
    <div className="size-full overflow-hidden">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={TONE_CLASS[tone]}
          style={{ height: barPx, marginBottom: pitchPx - barPx }}
        />
      ))}
    </div>
  );
}

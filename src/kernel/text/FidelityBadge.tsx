/**
 * Fidelity honesty rule — SPEC.md §4.10. Kernel-provided because it is a
 * promise the product makes, not a decoration a plugin may restyle away.
 *
 *   "greeked"       — shapes only, no manuscript behind them
 *   "working proof" — real copy, approximate measurement (§4.10)
 */
export type Fidelity = 'greeked' | 'working-proof';

const LABEL: Record<Fidelity, string> = {
  greeked: 'greeked',
  'working-proof': 'working proof',
};

export interface FidelityBadgeProps {
  fidelity: Fidelity;
  className?: string;
}

export function FidelityBadge({ fidelity, className }: FidelityBadgeProps) {
  return (
    <span
      data-fidelity={fidelity}
      title="Maquette shows structure and rhythm, never print truth."
      className={
        'inline-flex items-center gap-1 rounded-tool border border-border-hairline ' +
        'bg-surface px-1.5 py-0.5 font-ui text-micro leading-none tracking-wide ' +
        'text-ink-soft select-none' +
        (className ? ` ${className}` : '')
      }
    >
      <span aria-hidden="true" className="size-1 rounded-full bg-guide" />
      {LABEL[fidelity]}
    </span>
  );
}

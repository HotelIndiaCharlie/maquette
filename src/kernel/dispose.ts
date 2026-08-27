/** Everything a plugin registers hands back one of these (SPEC.md §4.4/§4.5). */
export type Dispose = () => void;

/** Collect several disposers into one — what a plugin returns from `register`. */
export function disposeAll(...disposers: Array<Dispose | void>): Dispose {
  return () => {
    for (const d of disposers) if (typeof d === 'function') d();
  };
}

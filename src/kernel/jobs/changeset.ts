/**
 * Applying a ChangeSet — SPEC.md §4.9. The ONLY way a job result reaches the
 * document: through the bus, undoable as one step, logged as one group.
 *
 * Accept/reject is per intent GROUP, never per micro-command (P8).
 */
import { dispatchAs, transactAs } from '../commands/bus';
import type { ChangeSet } from './types';

export interface ApplyOptions {
  /** Groups to apply. Omitted = every group in the ChangeSet. */
  acceptGroupIds?: string[];
  /** Who is applying — recorded on every log entry. Defaults to `kernel`. */
  source?: string;
}

export interface ApplyResult {
  applied: string[]; // group ids
  commandCount: number;
}

export function applyChangeSet(cs: ChangeSet, opts: ApplyOptions = {}): ApplyResult {
  const accept = opts.acceptGroupIds;
  const groups = accept ? cs.groups.filter((g) => accept.includes(g.id)) : cs.groups;
  const source = opts.source ?? 'kernel';

  if (groups.length === 0) return { applied: [], commandCount: 0 };

  const label =
    groups.length === cs.groups.length
      ? cs.label
      : `${cs.label} (${groups.length}/${cs.groups.length})`;

  let commandCount = 0;
  transactAs(source, label, () => {
    for (const group of groups) {
      for (const cmd of group.commands) {
        dispatchAs(source, cmd);
        commandCount += 1;
      }
    }
  });

  return { applied: groups.map((g) => g.id), commandCount };
}

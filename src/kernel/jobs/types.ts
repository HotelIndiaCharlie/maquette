/**
 * Job seam — SPEC.md §4.9. Shipped with a MOCK executor; no built-in uses it,
 * but P6–P8 require it, so it is kernel (criterion (c): a swappable seam).
 *
 * Results NEVER auto-apply. They arrive as ChangeSets and are applied only
 * through `applyChangeSet` (CLAUDE.md §9).
 */
import type { Command } from '../commands/bus';
import type { Dispose } from '../dispose';

export interface ChangeSet {
  id: string;
  label: string;
  groups: Array<{
    id: string;
    label: string; // intent-level grouping
    commands: Command[];
  }>;
}

export interface JobRequest {
  kind: string;
  payload: unknown;
  scope: { spreadIds: string[]; lockedBlockIds?: string[] }; // displayed guarantee
}

export type JobStatus = 'queued' | 'running' | 'done' | 'cancelled' | 'failed';

export interface JobHandle {
  id: string;
  status(): JobStatus;
  onProgress(cb: (pct: number, note?: string) => void): Dispose;
  onPartial(cb: (partial: ChangeSet) => void): Dispose;
  cancel(): void;
  result: Promise<ChangeSet>;
}

export interface JobExecutor {
  run(req: JobRequest): JobHandle;
}

export class JobCancelledError extends Error {
  override name = 'JobCancelledError';
  constructor(public jobId: string) {
    super(`job cancelled: ${jobId}`);
  }
}

/** Which blocks a command would touch — used to prove the lock guarantee. */
export function blockIdsTouched(cmd: Command): string[] {
  switch (cmd.type) {
    case 'block/add':
      return [cmd.block.id];
    case 'block/update':
    case 'block/remove':
      return [cmd.blockId];
    default:
      return [];
  }
}

export function changeSetTouches(cs: ChangeSet, blockIds: ReadonlyArray<string>): boolean {
  const locked = new Set(blockIds);
  return cs.groups.some((g) => g.commands.some((c) => blockIdsTouched(c).some((id) => locked.has(id))));
}

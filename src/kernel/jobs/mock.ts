/**
 * MockExecutor — SPEC.md §4.9, kernel-provided and deterministic:
 *
 *   · seeded artificial latency, 2–8 s
 *   · progress ticks
 *   · one partial ChangeSet midway
 *   · honours cancel() within 100 ms
 *   · NEVER emits a command touching `scope.lockedBlockIds`
 *   · two demo kinds: 'nudge-baselines' and 'echo'
 *
 * It exists so the async delegation UX (P6–P8) is testable by a human with no
 * agent anywhere near the machine.
 */
import type { Command } from '../commands/bus';
import { getDocument } from '../commands/bus';
import type { Dispose } from '../dispose';
import { baselines } from '../geometry/grid';
import type { Block, DocumentV1, Rect } from '../model/types';
import { round3 } from '../model/reducers';
import {
  JobCancelledError,
  type ChangeSet,
  type JobExecutor,
  type JobHandle,
  type JobRequest,
  type JobStatus,
} from './types';

export const MOCK_MIN_LATENCY_MS = 2000;
export const MOCK_MAX_LATENCY_MS = 8000;
export const MOCK_PROGRESS_TICKS = 10;
export const DEFAULT_BASELINE_LEADING_PT = 12;

/** mulberry32 — small, seeded, and identical on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockExecutorOptions {
  seed?: number;
  /** Where the document comes from; injectable so tests need no global state. */
  getDocument?: () => DocumentV1;
  /** Scales all latency. 1 = real 2–8 s. Tests use fake timers, not this. */
  timeScale?: number;
}

export function createMockExecutor(opts: MockExecutorOptions = {}): JobExecutor {
  const seed = opts.seed ?? 0x9e3779b9;
  const readDoc = opts.getDocument ?? getDocument;
  const timeScale = opts.timeScale ?? 1;
  const random = rng(seed);
  let counter = 0;

  return {
    run(req: JobRequest): JobHandle {
      counter += 1;
      const id = `job_${seed.toString(36)}_${counter}`;
      const locked = new Set(req.scope.lockedBlockIds ?? []);
      const full = buildChangeSet(id, req, readDoc(), locked);
      const partial = firstGroupOnly(full);

      const duration =
        (MOCK_MIN_LATENCY_MS + random() * (MOCK_MAX_LATENCY_MS - MOCK_MIN_LATENCY_MS)) * timeScale;
      const tick = duration / MOCK_PROGRESS_TICKS;

      let status: JobStatus = 'queued';
      const timers: Array<ReturnType<typeof setTimeout>> = [];
      const progressCbs = new Set<(pct: number, note?: string) => void>();
      const partialCbs = new Set<(p: ChangeSet) => void>();

      let settle!: (cs: ChangeSet) => void;
      let fail!: (err: unknown) => void;
      const result = new Promise<ChangeSet>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });
      // The consumer may attach `.catch` after cancel(); keep node/vitest quiet.
      result.catch(() => undefined);

      const at = (ms: number, fn: () => void) => {
        timers.push(setTimeout(fn, ms));
      };

      status = 'running';
      for (let i = 1; i <= MOCK_PROGRESS_TICKS; i += 1) {
        at(tick * i, () => {
          if (status !== 'running') return;
          const pct = (i / MOCK_PROGRESS_TICKS) * 100;
          for (const cb of progressCbs) cb(pct, `${req.kind}`);
        });
      }
      at(duration / 2, () => {
        if (status !== 'running') return;
        for (const cb of partialCbs) cb(partial);
      });
      at(duration, () => {
        if (status !== 'running') return;
        status = 'done';
        settle(full);
      });

      return {
        id,
        status: () => status,
        onProgress(cb): Dispose {
          progressCbs.add(cb);
          return () => progressCbs.delete(cb);
        },
        onPartial(cb): Dispose {
          partialCbs.add(cb);
          return () => partialCbs.delete(cb);
        },
        cancel() {
          if (status !== 'queued' && status !== 'running') return;
          status = 'cancelled';
          for (const t of timers) clearTimeout(t);
          timers.length = 0;
          fail(new JobCancelledError(id));
        },
        result,
      };
    },
  };
}

/** The kernel's shared instance. Swap the seam, not this. */
export const mockExecutor: JobExecutor = createMockExecutor();

/* ── demo kinds ───────────────────────────────────────────────────────────── */

function buildChangeSet(
  jobId: string,
  req: JobRequest,
  doc: DocumentV1,
  locked: Set<string>,
): ChangeSet {
  switch (req.kind) {
    case 'nudge-baselines':
      return nudgeBaselines(jobId, req, doc, locked);
    case 'echo':
      return echo(jobId, req, doc, locked);
    default:
      return { id: jobId, label: `Unknown job: ${req.kind}`, groups: [] };
  }
}

function eligibleBlocks(doc: DocumentV1, spreadId: string, locked: Set<string>): Block[] {
  const spread = doc.spreads.find((s) => s.id === spreadId);
  if (!spread) return [];
  return spread.blocks.filter((b) => !locked.has(b.id));
}

/** Move every unlocked frame's top edge onto the nearest baseline. */
function nudgeBaselines(
  jobId: string,
  req: JobRequest,
  doc: DocumentV1,
  locked: Set<string>,
): ChangeSet {
  const groups: ChangeSet['groups'] = [];

  for (const spreadId of req.scope.spreadIds) {
    const blocks = eligibleBlocks(doc, spreadId, locked);
    const grid = baselines(doc.page, DEFAULT_BASELINE_LEADING_PT);
    if (grid.length === 0) continue;

    const commands: Command[] = [];
    for (const block of blocks) {
      const frame = block.frame as Rect;
      const target = nearestOf(frame.y, grid);
      if (Math.abs(target - frame.y) < 0.001) continue;
      commands.push({
        type: 'block/update',
        spreadId,
        blockId: block.id,
        patch: { frame: { ...frame, y: round3(target) } },
      });
    }
    if (commands.length === 0) continue;

    const index = doc.spreads.findIndex((s) => s.id === spreadId);
    groups.push({
      id: `${jobId}:${spreadId}`,
      label: `Spread ${index + 1}: snap ${commands.length} frame${
        commands.length === 1 ? '' : 's'
      } to baseline`,
      commands,
    });
  }

  return { id: jobId, label: 'Nudge frames onto the baseline grid', groups };
}

/** P6's channel: a mark with a note comes back as a plausible canned edit. */
function echo(jobId: string, req: JobRequest, doc: DocumentV1, locked: Set<string>): ChangeSet {
  const payload = (req.payload ?? {}) as {
    targetBlockId?: string;
    spreadId?: string;
    note?: string;
    gesture?: string;
  };
  const spreadId = payload.spreadId ?? req.scope.spreadIds[0];
  if (!spreadId || !payload.targetBlockId || locked.has(payload.targetBlockId)) {
    return { id: jobId, label: 'Echo: nothing to do', groups: [] };
  }

  const block = eligibleBlocks(doc, spreadId, locked).find((b) => b.id === payload.targetBlockId);
  if (!block) return { id: jobId, label: 'Echo: target is gone', groups: [] };

  const frame = block.frame as Rect;
  const note = payload.note?.trim() || 'no note';

  return {
    id: jobId,
    label: `Echo: “${note}”`,
    groups: [
      {
        id: `${jobId}:nudge`,
        label: 'Nudge the frame down one line',
        commands: [
          {
            type: 'block/update',
            spreadId,
            blockId: block.id,
            patch: { frame: { ...frame, y: round3(frame.y + 4) } },
          },
        ],
      },
      {
        id: `${jobId}:widen`,
        label: 'Widen the frame by 6 mm',
        commands: [
          {
            type: 'block/update',
            spreadId,
            blockId: block.id,
            patch: { frame: { ...frame, w: round3(frame.w + 6) } },
          },
        ],
      },
    ],
  };
}

function firstGroupOnly(cs: ChangeSet): ChangeSet {
  return { ...cs, label: `${cs.label} (partial)`, groups: cs.groups.slice(0, 1) };
}

function nearestOf(value: number, candidates: number[]): number {
  let best = value;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

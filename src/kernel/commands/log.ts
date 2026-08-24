/**
 * Command log — SPEC.md §4.3. Every mutation that ever reaches the document
 * passes through here, stamped with the plugin id that asked for it.
 *
 * P9 (`constraint-mining`) reads this log to notice repeated intent, so entries
 * carry the optional group id/label written by `transact` — a superset of the
 * §4.3 shape, never a replacement.
 */
import type { Command } from './bus';

export interface LogEntry {
  ts: number;
  cmd: Command;
  source: string; // plugin id
  /** Set when the command was part of a `transact` group (one gesture / job). */
  groupId?: string;
  label?: string;
}

const MAX_LOG_ENTRIES = 5000;

export class CommandLog {
  private entries: LogEntry[] = [];
  private listeners = new Set<(entries: ReadonlyArray<LogEntry>) => void>();

  append(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_LOG_ENTRIES);
    }
    this.notify();
  }

  list(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    this.notify();
  }

  subscribe(cb: (entries: ReadonlyArray<LogEntry>) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    const snapshot = this.entries;
    for (const l of this.listeners) l(snapshot);
  }
}

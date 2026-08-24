/**
 * Feature flags — SPEC.md §1: "the playground arena and feature flags are
 * central product surface, not side rooms." Every probe (§8) is flag-gated.
 *
 * Sources, in order: URL (?flags=a,b), then localStorage. The shell owns this;
 * plugins only ever read through `ctx.flags.get(name)`.
 */
import type { FlagsApi } from '@/kernel';

const STORAGE_KEY = 'maquette:flags';

function readStored(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function readUrl(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const params = new URLSearchParams(window.location.search);
  const out = new Set<string>();
  for (const value of params.getAll('flags')) {
    for (const name of value.split(',')) if (name.trim()) out.add(name.trim());
  }
  for (const name of params.getAll('flag')) if (name.trim()) out.add(name.trim());
  return out;
}

let enabled = new Set([...readStored(), ...readUrl()]);
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabled]));
  } catch {
    /* private mode: flags stay session-only */
  }
  for (const l of listeners) l();
}

export const flags: FlagsApi & {
  set(name: string, on: boolean): void;
  all(): string[];
  subscribe(cb: () => void): () => void;
} = {
  get: (name) => enabled.has(name),
  set(name, on) {
    if (on) enabled.add(name);
    else enabled.delete(name);
    persist();
  },
  all: () => [...enabled].sort(),
  subscribe(cb) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/** Test seam. */
export function __setFlagsForTests(names: string[]): void {
  enabled = new Set(names);
}

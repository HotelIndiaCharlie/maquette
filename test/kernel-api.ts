/**
 * Extract the kernel's public export list — the input to the doc-version hash
 * (D3, docs/adr/006-plugin-authoring-toolkit.md).
 *
 * We parse EXPORT STATEMENTS, never raw file content: hashing the file would
 * mean a comment edit breaks the build, which trains authors to bump the hash
 * without reading the doc — the exact rot this mechanism exists to prevent.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const KERNEL_INDEX = join(process.cwd(), 'src', 'kernel', 'index.ts');
export const API_DOC = join(process.cwd(), 'docs', 'plugin-api.md');

/**
 * One entry per exported identifier, as `value:name` or `type:name`. The kind
 * is part of the entry so that turning a value export into a type-only export
 * — a real change to what a plugin can do — moves the hash.
 */
export function extractExports(source: string): string[] {
  // Comments first: an identifier inside a commented-out export is not exported.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const statement = /export\s+(type\s+)?\{([^}]*)\}/g;
  const found: string[] = [];

  for (let m = statement.exec(stripped); m !== null; m = statement.exec(stripped)) {
    const kind = m[1] ? 'type' : 'value';
    for (const raw of (m[2] ?? '').split(',')) {
      const clause = raw.trim();
      if (!clause) continue;
      // `X as Y` exports Y; `type X` inside a value clause is a type export.
      const renamed = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(clause);
      const inlineType = /^type\s+/.test(clause);
      const name = renamed?.[1] ?? clause.replace(/^type\s+/, '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      found.push(`${inlineType ? 'type' : kind}:${name}`);
    }
  }

  return [...new Set(found)].sort();
}

export function hashExports(entries: ReadonlyArray<string>): string {
  return createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 12);
}

export interface DocFrontmatter {
  hash: string | null;
  version: string | null;
  count: number | null;
}

export function readFrontmatter(markdown: string): DocFrontmatter {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? '';
  const field = (name: string) =>
    new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(block)?.[1]?.trim() ?? null;
  const count = field('kernel-api-exports');
  return {
    hash: field('kernel-api-hash'),
    version: field('kernel-api-version'),
    count: count === null ? null : Number(count),
  };
}

export function readKernelApi() {
  const entries = extractExports(readFileSync(KERNEL_INDEX, 'utf8'));
  return { entries, hash: hashExports(entries), count: entries.length };
}

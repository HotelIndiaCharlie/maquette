// @vitest-environment node
/**
 * THE LAW, mechanically — SPEC.md §4.5, §4.11.
 *
 * Each fixture is source that violates one boundary rule. It is linted through
 * the project's real eslint.config.js at a path inside src/plugins/, so if a
 * rule is ever loosened or deleted, this test — and CI — goes red.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const fixtureDir = join(root, 'test', 'fixtures', 'boundaries');

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: root });
});

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, `${name}.txt`), 'utf8');
}

/** Lint a fixture as if it lived at `src/plugins/<filePath>`. */
async function lintAsPlugin(name: string, filePath = 'demo/index.ts') {
  const results = await eslint.lintText(fixture(name), {
    filePath: join(root, 'src', 'plugins', filePath),
    warnIgnored: false,
  });
  const messages = results.flatMap((r) => r.messages);
  return {
    errors: messages.filter((m) => m.severity === 2),
    text: messages.map((m) => `${m.ruleId}: ${m.message}`).join('\n'),
  };
}

describe('plugin import boundaries', () => {
  it('accepts a legal plugin entry', async () => {
    const { errors, text } = await lintAsPlugin('legal-plugin');
    expect(text).toBe('');
    expect(errors).toHaveLength(0);
  });

  it('rejects a cross-plugin import (rule 2)', async () => {
    const { errors, text } = await lintAsPlugin('cross-plugin-import');
    expect(errors.length).toBeGreaterThan(0);
    expect(text).toMatch(/Cross-plugin imports are forbidden/);
  });

  it('rejects importing the shell (rule 2)', async () => {
    const { errors, text } = await lintAsPlugin('shell-import');
    expect(errors.length).toBeGreaterThan(0);
    expect(text).toMatch(/may not import the shell/);
  });

  it('rejects reaching into kernel internals (rule 2)', async () => {
    const { errors, text } = await lintAsPlugin('kernel-internals-import');
    expect(errors.length).toBeGreaterThan(0);
    expect(text).toMatch(/kernel public API only/);
  });

  it('rejects a relative import that leaves the plugin folder (rule 1)', async () => {
    const { errors, text } = await lintAsPlugin('relative-escape');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/leaves the plugin folder/);
  });

  it('catches the escape from a nested plugin file too', async () => {
    const nested = await eslint.lintText(
      "import { flags } from '../../../shell/flags';\nexport const x = flags;\n",
      { filePath: join(root, 'src/plugins/demo/a/b.ts'), warnIgnored: false },
    );
    const text = nested.flatMap((r) => r.messages).map((m) => m.message).join('\n');
    expect(text).toMatch(/leaves the plugin folder/);
  });

  it('allows a relative import that stays inside the plugin', async () => {
    const inside = await eslint.lintText(
      "import { helper } from '../helper';\nexport const x = helper;\n",
      { filePath: join(root, 'src/plugins/demo/a/b.ts'), warnIgnored: false },
    );
    expect(inside.flatMap((r) => r.messages)).toHaveLength(0);
  });

  it('rejects touching IndexedDB directly (rule 3)', async () => {
    const { errors, text } = await lintAsPlugin('direct-idb-import');
    expect(errors.length).toBeGreaterThan(0);
    expect(text).toMatch(/ctx\.storage/);
  });

  it('rejects localStorage and indexedDB globals (rule 3)', async () => {
    const { errors, text } = await lintAsPlugin('direct-storage-globals');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/sidecars/);
  });
});

describe('kernel independence', () => {
  it('rejects the kernel importing the shell or a plugin', async () => {
    const results = await eslint.lintText(
      "import { flags } from '@/shell/flags';\nimport { x } from '@/plugins/flatplan';\nexport const y = [flags, x];\n",
      { filePath: join(root, 'src/kernel/model/bad.ts'), warnIgnored: false },
    );
    const messages = results.flatMap((r) => r.messages);
    expect(messages.filter((m) => m.severity === 2).length).toBeGreaterThanOrEqual(2);
    expect(messages.map((m) => m.message).join('\n')).toMatch(/must not depend on the shell/);
  });
});

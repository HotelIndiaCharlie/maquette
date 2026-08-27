// @vitest-environment node
/**
 * THE DOC, mechanically — decision D3 in docs/adr/006-plugin-authoring-toolkit.md.
 *
 * `docs/plugin-api.md` is the one thing standing between a plugin-authoring
 * session and a hallucinated kernel API. A hand-maintained version header rots
 * silently, so the doc is pinned to a hash of the kernel's export list and this
 * test is the pin. Same shape as test/boundaries.test.ts: the rule is the test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  API_DOC,
  extractExports,
  hashExports,
  readFrontmatter,
  readKernelApi,
} from './kernel-api';

describe('the export extractor', () => {
  it('reads value and type exports, and the renamed form', () => {
    expect(
      extractExports(
        "export { a, b as c } from './x';\nexport type { D } from './y';\nexport { type E } from './z';\n",
      ),
    ).toEqual(['type:D', 'type:E', 'value:a', 'value:c']);
  });

  it('ignores exports inside comments, so prose edits never move the hash', () => {
    const withComment =
      "/** export { ghost } from './nowhere'; */\n// export { alsoGhost } from './nowhere';\nexport { real } from './x';\n";
    expect(extractExports(withComment)).toEqual(['value:real']);
  });

  it('hashes the list, not the file', () => {
    const one = extractExports("export { a, b } from './x';");
    const spacedAndCommented = extractExports("// note\nexport {\n  b,\n  a,\n} from './x';\n");
    expect(hashExports(one)).toBe(hashExports(spacedAndCommented));
  });
});

describe('docs/plugin-api.md tracks src/kernel/index.ts', () => {
  const { entries, hash, count } = readKernelApi();
  const doc = readFileSync(API_DOC, 'utf8');
  const front = readFrontmatter(doc);

  it('declares a version, a hash and an export count', () => {
    expect(front.version, 'kernel-api-version missing from frontmatter').toBeTruthy();
    expect(front.hash, 'kernel-api-hash missing from frontmatter').toBeTruthy();
    expect(front.count, 'kernel-api-exports missing from frontmatter').toBe(count);
  });

  it('matches the kernel export list', () => {
    if (front.hash === hash) return;

    // The doc records the list it was written against only as a hash, so we
    // cannot name what changed against THAT list. We can name the current one,
    // which is what the author has to reconcile the doc with.
    const message = [
      '',
      'docs/plugin-api.md is out of date with src/kernel/index.ts.',
      '',
      `  doc  hash: ${front.hash ?? '(none)'}   exports: ${front.count ?? '(none)'}`,
      `  code hash: ${hash}   exports: ${count}`,
      '',
      'The kernel public API changed. A plugin-authoring session reads that doc',
      'INSTEAD of the code, so an undocumented export is an export no plugin will',
      'ever use, and a removed one is an API a session will hallucinate.',
      '',
      'To fix, in this order:',
      '  1. Diff src/kernel/index.ts against the doc and update the affected section.',
      '  2. Bump  kernel-api-version  in the frontmatter.',
      '  3. Set   kernel-api-hash: ' + hash,
      '  4. Set   kernel-api-exports: ' + count,
      '',
      'Do NOT edit the hash without editing the prose. That is the rot this test exists',
      'to prevent (docs/adr/006-plugin-authoring-toolkit.md, D3).',
      '',
      'Current kernel exports, sorted:',
      ...entries.map((e) => `  ${e}`),
      '',
    ].join('\n');

    throw new Error(message);
  });
});

describe('the doc covers what it claims to cover', () => {
  const { entries } = readKernelApi();
  const doc = readFileSync(API_DOC, 'utf8');

  /**
   * Not every one of the 177 exports needs a table row — plenty are kernel- and
   * test-facing. But the ones a plugin cannot work without must be named, or the
   * doc has failed at its one job.
   */
  const MUST_BE_NAMED = [
    'BlockTypeDef', 'ToolDef', 'OverlayDef', 'PanelDef', 'ViewDef',
    'SpreadPaper', 'BlockLayer', 'OverlayLayer',
    'useDocument', 'useSpread', 'useSelection', 'useViewport',
    'useRegistry', 'useActiveTool', 'useCommandLog', 'useHistoryState',
    'transact', 'getDocument', 'replaceDocument',
    'activeTool', 'forwardPointer', 'toSpreadPoint',
    'greek', 'measure', 'wordsToFill', 'FidelityBadge',
    'applyChangeSet', 'changeSetTouches',
    'normalizeFrame', 'newId', 'ptToPx', 'snapPointFine', 'snapRectCoarse',
    'PLUGIN_ID_PATTERN', 'MIN_BLOCK_W_MM', 'MIN_BLOCK_H_MM', 'DEFAULT_PAGE',
  ] as const;

  it.each(MUST_BE_NAMED)('names %s', (name) => {
    expect(
      entries.some((e) => e.endsWith(`:${name}`)),
      `${name} is in the MUST_BE_NAMED list but no longer exported by the kernel`,
    ).toBe(true);
    expect(doc.includes(name), `docs/plugin-api.md never mentions ${name}`).toBe(true);
  });

  it('states the anti-hallucination rule verbatim', () => {
    expect(doc).toMatch(/BLOCKED: requires kernel amendment/);
  });

  it('lists both the allowed and the forbidden imports', () => {
    for (const allowed of ['@/kernel', '@/components/ui', '@/styles']) {
      expect(doc.includes(allowed), `allowed import ${allowed} not documented`).toBe(true);
    }
    for (const forbidden of ['@/plugins/*', '@/shell', '@/kernel/*/**', 'idb-keyval']) {
      expect(doc.includes(forbidden), `forbidden import ${forbidden} not documented`).toBe(true);
    }
  });
});

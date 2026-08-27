#!/usr/bin/env node
/**
 * `pnpm verify:plugin <id>` — SPEC.md §5 part 6, made executable.
 *
 * Two checks the handovers call "worth repeating per built-in", and which have
 * so far been done by eye:
 *
 *   INDEPENDENCE (SPEC.md §4.5 rule 5) — adding the feature modified zero files
 *   outside src/plugins/<id>/, except ONE line in src/shell/plugins.ts.
 *
 *   REMOVAL (SPEC.md §4.5 rule 4) — deleting the folder and that line leaves
 *   the app compiling. Performed in a scratch copy: this script never mutates
 *   the working tree.
 *
 * Usage:  pnpm verify:plugin <id> [--base <ref>] [--skip-removal]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--'));
const skipRemoval = argv.includes('--skip-removal');
const baseArg = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : null;

const LOAD_LIST = 'src/shell/plugins.ts';

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

/** Porcelain lines are column-significant: trimming eats the status gutter. */
function gitPorcelain() {
  try {
    // -uall so an untracked DIRECTORY is listed as its files, not as itself.
    return execFileSync('git', ['status', '--porcelain', '-uall'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

function gitQuiet(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

if (!id) die('Usage: pnpm verify:plugin <id> [--base <ref>] [--skip-removal]');
const folder = `src/plugins/${id}`;
if (!existsSync(join(root, folder))) die(`${folder}/ does not exist.`);

/* ── 1 · INDEPENDENCE ──────────────────────────────────────────────────── */

/**
 * The branch point. Handover 002: "start a fresh branch off dev", so origin/dev
 * is the default. Override with --base for any other topology.
 */
function resolveBase() {
  if (baseArg) return gitQuiet('rev-parse', baseArg) ? baseArg : die(`unknown ref: ${baseArg}`);
  for (const candidate of ['origin/dev', 'origin/main', 'dev', 'main']) {
    const merge = gitQuiet('merge-base', 'HEAD', candidate);
    if (merge) return merge;
  }
  return null;
}

const base = resolveBase();
console.log(`\n  Verifying ${folder}\n`);

let independence = true;
if (!base) {
  console.log('  ⚠ independence: no branch point found (no origin/dev, origin/main, dev or main).');
  console.log('    Pass --base <ref> to check it.');
} else {
  // Committed changes since the branch point, PLUS anything uncommitted —
  // work in progress counts, or the check passes for the wrong reason.
  const committed = gitQuiet('diff', '--name-only', `${base}...HEAD`) ?? '';
  const uncommitted = gitPorcelain();
  const touched = new Set(
    [
      ...committed.split('\n'),
      ...uncommitted.split('\n').map((l) => l.slice(3).split(' -> ').pop() ?? ''),
    ]
      .map((f) => f.trim())
      .filter(Boolean),
  );

  const strays = [...touched].filter((f) => !f.startsWith(`${folder}/`) && f !== LOAD_LIST).sort();

  if (strays.length > 0) {
    independence = false;
    console.log('  ✗ independence — files changed outside the plugin folder:\n');
    for (const f of strays) console.log(`      ${f}`);
    console.log(
      `\n    SPEC.md §4.5 rule 5: adding a feature modifies ZERO files outside\n` +
        `    ${folder}/, except one line in ${LOAD_LIST}.\n` +
        '    (A toolkit or docs change on the same branch will show here too —\n' +
        '     re-run with --base pointing at this plugin\'s own branch point.)',
    );
  } else {
    console.log(`  ✓ independence — nothing outside ${folder}/ except ${LOAD_LIST}`);
  }

  // The "one line" half of the rule.
  if (touched.has(LOAD_LIST)) {
    const diff = gitQuiet('diff', `${base}...HEAD`, '--', LOAD_LIST) ?? '';
    const working = gitQuiet('diff', '--', LOAD_LIST) ?? '';
    const added = `${diff}\n${working}`
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++') && l.slice(1).trim());
    // One import line + one PLUGIN_LIST entry is the expected shape.
    if (added.length > 2) {
      console.log(
        `  ⚠ ${LOAD_LIST} gained ${added.length} lines. The rule allows the import\n` +
          '    plus one PLUGIN_LIST entry. Check it is not carrying logic:',
      );
      for (const l of added) console.log(`      ${l}`);
    } else {
      console.log(`  ✓ load list — ${added.length} line(s) added to ${LOAD_LIST}`);
    }
  } else {
    console.log(`  ⚠ ${LOAD_LIST} is unchanged — the plugin is not in PLUGIN_LIST yet.`);
  }
}

/* ── 2 · REMOVAL ───────────────────────────────────────────────────────── */

let removal = true;
if (skipRemoval) {
  console.log('  – removal — skipped (--skip-removal)');
} else {
  const scratch = mkdtempSync(join(tmpdir(), `maquette-removal-${id}-`));
  try {
    // Copy the source tree, not node_modules. The working tree is never touched.
    for (const entry of readdirSync(root)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      cpSync(join(root, entry), join(scratch, entry), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');

    // Remove the plugin, exactly as a human deleting the feature would.
    rmSync(join(scratch, folder), { recursive: true, force: true });

    const loadListPath = join(scratch, LOAD_LIST);
    const before = readFileSync(loadListPath, 'utf8');
    const after = before
      .split('\n')
      .filter((line) => !new RegExp(`['"@/]*plugins/${id}['"]|\\b${camel(id)}\\b`).test(line))
      .join('\n');
    writeFileSync(loadListPath, after);
    const linesRemoved = before.split('\n').length - after.split('\n').length;

    // tsbuildinfo would otherwise be written into the SHARED node_modules and
    // poison the real build's incremental state.
    for (const cfg of ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.test.json']) {
      const p = join(scratch, cfg);
      if (!existsSync(p)) continue;
      writeFileSync(
        p,
        readFileSync(p, 'utf8').replace(
          /"tsBuildInfoFile":\s*"[^"]*"/,
          `"tsBuildInfoFile": "./.removal-check/${cfg}.tsbuildinfo"`,
        ),
      );
    }

    execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-b', '--force', '--pretty', 'false'], {
      cwd: scratch,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(
      `  ✓ removal — folder deleted (+${linesRemoved} load-list line(s)); the app still compiles`,
    );
  } catch (err) {
    removal = false;
    console.log('  ✗ removal — the app does NOT compile without this plugin:\n');
    console.log(String(err.stdout ?? err.message).split('\n').slice(0, 25).map((l) => `      ${l}`).join('\n'));
    console.log(
      '\n    SPEC.md §4.5 rule 4: removing the folder and its load-list line must\n' +
        '    leave the app compiling. Something outside the folder depends on it.',
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function camel(kebab) {
  const [first, ...rest] = kebab.split('-');
  return first + rest.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

console.log('');
process.exit(independence && removal ? 0 : 1);

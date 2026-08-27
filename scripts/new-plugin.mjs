#!/usr/bin/env node
/**
 * `pnpm new:plugin <id>` — scaffold a plugin from src/plugins/example/.
 *
 * The example plugin is compiled and boundary-linted on every CI run, so what
 * this produces is guaranteed to compile against the REAL kernel — which is the
 * whole point (docs/adr/006-plugin-authoring-toolkit.md, D4).
 *
 * It deliberately DOES NOT touch src/shell/plugins.ts. Adding that one line
 * stays a conscious human act: it is the line SPEC.md §4.5 rule 5 is about, and
 * keeping it manual keeps the "one line" discipline visible.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Kept in sync with src/kernel/plugins/boundaries.ts by scripts/new-plugin.test. */
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const root = process.cwd();
const SOURCE = join(root, 'src', 'plugins', 'example');
const TEMPLATE = join(root, 'docs', 'templates', 'plugin-packet.md');

const id = process.argv[2];

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

if (!id) die('Usage: pnpm new:plugin <id>      (kebab-case, e.g. blocks-basic)');

if (!PLUGIN_ID_PATTERN.test(id)) {
  die(
    `"${id}" is not a valid plugin id.\n` +
      `  Must match ${PLUGIN_ID_PATTERN} — lowercase, digits, single hyphens.\n` +
      '  Folder name === id (SPEC.md §4.5 rule 1), so leading underscores and\n' +
      '  double underscores are out: `_example` and `__template__` are invalid.',
  );
}

const target = join(root, 'src', 'plugins', id);
if (existsSync(target)) die(`src/plugins/${id}/ already exists. Delete it or pick another id.`);
if (!existsSync(SOURCE)) die('src/plugins/example/ is missing — the scaffold source is gone.');

/* ── naming forms ──────────────────────────────────────────────────────── */
const parts = id.split('-');
const camel = parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const pascal = camel[0].toUpperCase() + camel.slice(1);
const title = parts.join(' ').replace(/^./, (c) => c.toUpperCase());

/* ── comment stripping ─────────────────────────────────────────────────── */
/**
 * The example plugin's comments teach; a scaffold's would just be lies about
 * code you are about to replace. Strip them and leave one honest header.
 */
function stripComments(source) {
  return (
    source
      // JSX comment expressions: {/* … */}
      .replace(/[ \t]*\{\s*\/\*[\s\S]*?\*\/\s*\}[ \t]*\n?/g, '')
      // block comments (incl. JSDoc) that own their lines
      .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, '')
      // whole-line // comments
      .replace(/^[ \t]*\/\/[^\n]*\n/gm, '')
      // collapse the holes they leave
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
  );
}

/* ── renaming ──────────────────────────────────────────────────────────── */
/**
 * Ordered, and the order matters: quoted forms before bare ones, Pascal before
 * lowercase. Every replacement is exercised by the acceptance check in
 * docs/handover — `pnpm new:plugin scratch-test` must typecheck and lint clean
 * with zero edits.
 */
const RENAMES = [
  [/data-example/g, `data-${id}`],
  // Routes and other kebab-space strings: '/playground/example' must not
  // become '/playground/camelCase'.
  [/\/example(?=['"/])/g, `/${id}`],
  [/'Example plugin'/g, `'${title} plugin'`],
  [/'Draw example'/g, `'Draw ${title}'`],
  [/'Example'/g, `'${title}'`],
  [/'example/g, `'${id}`],
  [/example_/g, `${id}_`],
  [/Example/g, pascal],
  [/example/g, camel],
];

function rename(source) {
  return RENAMES.reduce((acc, [from, to]) => acc.replace(from, to), source);
}

function renameFile(name) {
  return name.replace(/^Example/, pascal).replace(/^example\./, `${id}.`);
}

const HEADER = `/**\n * ${title} — SPEC.md §5 work packet: docs/packets/${id}.md\n *\n * A plugin lives entirely in src/plugins/${id}/ and imports only \`@/kernel\`,\n * \`@/components/ui\`, \`@/styles\` and its own folder (SPEC.md §4.5).\n * All mutations go through \`ctx.bus.dispatch\`; plugin data lives in\n * \`ctx.storage(ns)\` sidecars. Scaffolded from src/plugins/example/ —\n * read that folder and docs/plugin-api.md before changing this one.\n */\n`;

/* ── copy ──────────────────────────────────────────────────────────────── */
cpSync(SOURCE, target, { recursive: true });

const written = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const source = readFileSync(full, 'utf8');
    let out = rename(stripComments(source));
    if (entry === 'index.ts') out = HEADER + out;
    const next = join(dir, renameFile(entry));
    writeFileSync(full, out);
    if (next !== full) renameSync(full, next);
    written.push(relative(root, next));
  }
}
walk(target);

/* ── packet stub ───────────────────────────────────────────────────────── */
let packetPath = null;
if (existsSync(TEMPLATE)) {
  const dir = join(root, 'docs', 'packets');
  mkdirSync(dir, { recursive: true });
  packetPath = join(dir, `${id}.md`);
  if (existsSync(packetPath)) {
    console.warn(`  (docs/packets/${id}.md already exists — left untouched)`);
    packetPath = null;
  } else {
    writeFileSync(packetPath, readFileSync(TEMPLATE, 'utf8').replaceAll('<plugin-id>', id));
  }
} else {
  rmSync(target, { recursive: true, force: true });
  die('docs/templates/plugin-packet.md is missing — refusing to scaffold without a packet.');
}

/* ── report ────────────────────────────────────────────────────────────── */
console.log(`\n  Scaffolded src/plugins/${id}/\n`);
for (const f of written.sort()) console.log(`    ${f}`);
if (packetPath) console.log(`    ${relative(root, packetPath)}`);
console.log(`
  Next:
    1. Fill docs/packets/${id}.md   — the interview protocol is docs/plugin-authoring.md
    2. Implement against docs/plugin-api.md. Anything not in it does not exist.
    3. Add ONE line to src/shell/plugins.ts — this script deliberately did not.
    4. pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
    5. pnpm verify:plugin ${id}
`);

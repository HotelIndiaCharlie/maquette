#!/usr/bin/env node
/**
 * `pnpm lint:boundaries` — the named gate in CLAUDE.md §11.
 *
 * A thin wrapper: it runs the project's REAL eslint.config.js and reports only
 * the boundary rules, so a boundary violation is legible on its own instead of
 * buried in a full lint run. `pnpm lint` still catches the same violations —
 * this exists so the gate CLAUDE.md names actually runs, and so the failure
 * output cites SPEC.md rule numbers and nothing else.
 *
 * Deliberately NOT a second rule engine. One source of truth for the boundary
 * policy: eslint.config.js, guarded by test/boundaries.test.ts.
 */
import { ESLint } from 'eslint';

const BOUNDARY_RULES = new Set(['no-restricted-imports', 'no-restricted-globals']);
const TARGETS = ['src/kernel', 'src/plugins', 'src/shell'];

const eslint = new ESLint({ cwd: process.cwd(), errorOnUnmatchedPattern: false });
const results = await eslint.lintFiles(TARGETS);

let violations = 0;
for (const result of results) {
  const messages = result.messages.filter((m) => m.ruleId && BOUNDARY_RULES.has(m.ruleId));
  if (messages.length === 0) continue;
  const rel = result.filePath.replace(`${process.cwd()}/`, '');
  for (const m of messages) {
    violations += 1;
    console.error(`${rel}:${m.line}:${m.column}  ${m.message}`);
  }
}

const scanned = results.length;
if (violations > 0) {
  console.error(
    `\n${violations} boundary violation(s) in ${scanned} files.\n` +
      'The boundary policy lives in eslint.config.js and is guarded by\n' +
      'test/boundaries.test.ts. Fix the import — do not loosen the rule.',
  );
  process.exit(1);
}

console.log(`Boundaries clean: ${scanned} files, 0 violations (SPEC.md §4.5).`);

// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Plugin boundaries — SPEC.md §4.5, mechanically enforced.
 *
 * A plugin may import ONLY from `@/kernel` (public API), `@/components/ui`,
 * `@/styles`, and its own folder. Cross-plugin imports and shell imports are a
 * build error. The relative-path rules are scoped by depth: from
 * src/plugins/<id>/x.ts any `../` leaves the plugin; from
 * src/plugins/<id>/a/x.ts it takes `../../`; and so on.
 *
 * The fixture test in test/boundaries.test.ts lints violating source through
 * this exact config and fails CI if any rule stops catching it.
 */
const PLUGIN_FORBIDDEN_ALIASES = [
  {
    group: ['@/plugins/*', '@/plugins/*/**'],
    message:
      'Cross-plugin imports are forbidden (SPEC.md §4.5 rule 2). Share through the kernel instead.',
  },
  {
    group: ['@/shell', '@/shell/**'],
    message: 'Plugins may not import the shell (SPEC.md §4.5 rule 2).',
  },
  {
    group: ['@/kernel/*', '@/kernel/*/**'],
    message:
      'Import the kernel public API only: `@/kernel`. Kernel internals are not a plugin surface (SPEC.md §4.5 rule 2).',
  },
  {
    group: ['idb-keyval', 'idb-keyval/**'],
    message:
      'Plugins never touch IndexedDB directly — use ctx.storage(namespace) (SPEC.md §4.5 rule 3).',
  },
];

function escapeUp(depth) {
  const up = '../'.repeat(depth);
  return {
    group: [`${up}*`, `${up}**`],
    message:
      'This relative import leaves the plugin folder. A plugin lives entirely in src/plugins/<id>/ (SPEC.md §4.5 rule 1).',
  };
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results', 'reference'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The kernel is TS strict with no `any` (SPEC.md §3).
  {
    files: ['src/kernel/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/plugins/*', '@/plugins/*/**', '@/shell', '@/shell/**'],
              message: 'The kernel must not depend on the shell or on any plugin (SPEC.md §2).',
            },
          ],
        },
      ],
    },
  },

  // THE LAW — SPEC.md §4.5.
  {
    files: ['src/plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PLUGIN_FORBIDDEN_ALIASES }],
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Plugin data lives in ctx.storage(namespace) sidecars (SPEC.md §4.5 rule 3).',
        },
        {
          name: 'indexedDB',
          message: 'Plugin data lives in ctx.storage(namespace) sidecars (SPEC.md §4.5 rule 3).',
        },
      ],
    },
  },
  {
    files: ['src/plugins/*/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...PLUGIN_FORBIDDEN_ALIASES, escapeUp(1)] },
      ],
    },
  },
  {
    files: ['src/plugins/*/*/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...PLUGIN_FORBIDDEN_ALIASES, escapeUp(2)] },
      ],
    },
  },
  {
    files: ['src/plugins/*/*/*/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...PLUGIN_FORBIDDEN_ALIASES, escapeUp(3)] },
      ],
    },
  },

  // Node-side files: configs, tests, e2e, and the toolkit scripts behind
  // `pnpm new:plugin` / `verify:plugin` / `lint:boundaries`.
  {
    files: ['*.config.{ts,js}', 'e2e/**/*.ts', 'test/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);

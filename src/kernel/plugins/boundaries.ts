/**
 * Plugin boundaries — SPEC.md §4.5. The static half of this policy is enforced
 * by ESLint (`no-restricted-imports`, see eslint.config.js and the fixture test
 * in test/boundaries.test.ts). This file is the runtime half: the invariants a
 * loader can still check once the modules exist.
 */
import type { MaquettePlugin } from './types';

/** Import prefixes a file under src/plugins/<id>/ may name. */
export const ALLOWED_PLUGIN_IMPORTS = [
  '@/kernel', // public kernel API only — never @/kernel/<dir>/<file>
  '@/components/ui',
  '@/styles',
] as const;

/** Never, from a plugin. */
export const FORBIDDEN_PLUGIN_IMPORTS = [
  '@/plugins/*', // cross-plugin
  '@/shell', // the host
  '@/kernel/*/*', // kernel internals
] as const;

/** id must be a safe folder name, because folder name === id. */
export const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PluginContractError extends Error {
  override name = 'PluginContractError';
}

export function assertValidManifest(plugin: MaquettePlugin): void {
  if (!PLUGIN_ID_PATTERN.test(plugin.id)) {
    throw new PluginContractError(
      `plugin id "${plugin.id}" must be kebab-case and match its folder name`,
    );
  }
  if (typeof plugin.register !== 'function') {
    throw new PluginContractError(`plugin "${plugin.id}" has no register()`);
  }
  if (!plugin.name || !plugin.version) {
    throw new PluginContractError(`plugin "${plugin.id}" must declare name and version`);
  }
}

export function assertUniqueIds(plugins: ReadonlyArray<MaquettePlugin>): void {
  const seen = new Set<string>();
  for (const p of plugins) {
    if (seen.has(p.id)) throw new PluginContractError(`duplicate plugin id: ${p.id}`);
    seen.add(p.id);
  }
}

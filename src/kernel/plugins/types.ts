/**
 * THE PLUGIN CONTRACT — SPEC.md §4.5.
 *
 * A plugin lives entirely in src/plugins/<id>/ with one entry index.ts
 * exporting the manifest. It imports ONLY from `@/kernel`, `@/components/ui`,
 * `@/styles`, and its own folder. Cross-plugin imports are a build error.
 * Removing the folder + its one line in the load list leaves the app running.
 */
import type { Command } from '../commands/bus';
import type { LogEntry } from '../commands/log';
import type { Dispose } from '../dispose';
import type { JobExecutor } from '../jobs/types';
import type { DocumentV1 } from '../model/types';
import type {
  BlockTypeDef,
  OverlayDef,
  PanelDef,
  Registry,
  ToolDef,
  ViewDef,
} from '../registry/types';
import type { SelectionApi } from '../selection';
import type { SidecarStore } from '../storage/types';
import type { TextApi } from '../text';
import type { ViewportApi } from '../viewport';

export interface FlagsApi {
  get(name: string): boolean;
}

export interface PluginRegistryApi {
  blockTypes: Registry<BlockTypeDef>;
  tools: Registry<ToolDef>;
  overlays: Registry<OverlayDef>;
  panels: Registry<PanelDef>;
  views: Registry<ViewDef>;
}

export interface PluginBusApi {
  /** Stamps `source = pluginId` on every entry it writes to the log. */
  dispatch(cmd: Command): void;
  /** Several commands, one undo step, one log group (one gesture). */
  transact<T>(label: string, fn: () => T): T;
  getDocument(): DocumentV1;
  subscribeDoc(cb: (doc: DocumentV1) => void): Dispose;
  getLog(): ReadonlyArray<LogEntry>;
  subscribeLog(cb: (entries: ReadonlyArray<LogEntry>) => void): Dispose;
}

export interface PluginContext {
  pluginId: string;
  registry: PluginRegistryApi;
  bus: PluginBusApi;
  selection: SelectionApi;
  viewport: ViewportApi;
  /** Namespaced to pluginId; the ONLY persistence a plugin may touch. */
  storage: <T>(namespace: string) => SidecarStore<T>;
  jobs: JobExecutor;
  text: TextApi;
  flags: FlagsApi;
}

export interface MaquettePlugin {
  id: string; // folder name === id
  name: string;
  version: string;
  /** If set, the plugin loads only when the flag is enabled. */
  flag?: string;
  register(ctx: PluginContext): Dispose | void;
}

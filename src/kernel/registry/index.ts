/**
 * The five registries. Plugins write here; the shell reads here. Neither side
 * knows the other exists — SPEC.md §4.4, §4.7.
 */
import { createRegistry } from './create';
import type { BlockTypeDef, OverlayDef, PanelDef, Registry, ToolDef, ViewDef } from './types';

export const blockTypes: Registry<BlockTypeDef> = createRegistry<BlockTypeDef>('blockTypes');
export const tools: Registry<ToolDef> = createRegistry<ToolDef>('tools');
export const overlays: Registry<OverlayDef> = createRegistry<OverlayDef>('overlays');
export const panels: Registry<PanelDef> = createRegistry<PanelDef>('panels');
export const views: Registry<ViewDef> = createRegistry<ViewDef>('views');

export const registries = { blockTypes, tools, overlays, panels, views } as const;
export type Registries = typeof registries;

export { createRegistry, DuplicateRegistrationError } from './create';
export type { BlockTypeDef, OverlayDef, PanelDef, Registry, ToolDef, ViewDef, Layer } from './types';
export { useRegistry } from './hooks';
export { activeTool, activeToolStore, forwardPointer } from './activeTool';
export type { ActiveToolApi } from './activeTool';
export { useActiveTool } from './activeToolHooks';

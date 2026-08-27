/**
 * THE KERNEL PUBLIC API — the only thing a plugin may import from.
 *
 * Membership criterion (SPEC.md §2): something is here only if (a) two plugins
 * must share it to interoperate, (b) it defines the plugin contract itself, or
 * (c) it is a seam that must be swappable without breaking plugins.
 *
 * FROZEN after Lot 1. Amendments during Lot 1 require a demonstrated built-in
 * need plus an ADR (CLAUDE.md §2). After that: STOP and report BLOCKED.
 */

/* ── model ────────────────────────────────────────────────────────────────── */
export type {
  Block,
  BlockBase,
  DocumentV1,
  PageSetup,
  Rect,
  Spread,
  TextAttrs,
} from './model/types';
export {
  DEFAULT_COLS,
  DEFAULT_PAGE,
  MAX_COLS,
  MIN_BLOCK_H_MM,
  MIN_BLOCK_W_MM,
  MIN_COLS,
  spreadHeightMm,
  spreadWidthMm,
} from './model/types';
export { documentV1Schema, parseDocument, safeParseDocument } from './model/schema';
export { CURRENT_SCHEMA_VERSION, migrate } from './model/migrate';
export { createEmptyDocument, createSeedDocument, newId } from './model/seed';
export { KernelError, normalizeFrame, reduce, round3 } from './model/reducers';
export { useDocument, useSpread } from './model/hooks';

/* ── commands ─────────────────────────────────────────────────────────────── */
export type { Command } from './commands/bus';
export {
  canRedo,
  canUndo,
  dispatch,
  dispatchAs,
  getDocument,
  getLog,
  redo,
  replaceDocument,
  subscribeDoc,
  subscribeHistory,
  subscribeLog,
  transact,
  transactAs,
  undo,
  validateCommand,
} from './commands/bus';
export type { LogEntry } from './commands/log';
export { MAX_HISTORY_DEPTH } from './commands/history';
export { useCommandLog, useHistoryState } from './commands/hooks';

/* ── geometry ─────────────────────────────────────────────────────────────── */
export { PT, mmToPt, mmToPx, ptToMm, ptToPx, pxToMm, roundTo } from './geometry/units';
export {
  COARSE_COLS,
  COARSE_ROWS,
  baselines,
  coarseCell,
  columnEdges,
  columnWidthMm,
  marginBoxes,
  pageTextLefts,
  textWidthMm,
} from './geometry/grid';
export {
  FALLBACK_STEP_MM,
  SNAP_X_TOLERANCE_MM,
  SNAP_Y_TOLERANCE_MM,
  snapPointCoarse,
  snapPointFine,
  snapRectCoarse,
  snapXFine,
  snapYFine,
} from './geometry/snap';
export type { SnapContext, SnapResult, SnappedPoint } from './geometry/snap';

/* ── text seam ────────────────────────────────────────────────────────────── */
export { AVG_CHAR_WIDTH_RATIO, FidelityBadge, greek, measure, textApi, wordsToFill } from './text';
export type { Fidelity, MeasureAttrs, Measurement, TextApi } from './text';

/* ── selection · viewport · pointer ───────────────────────────────────────── */
export { isSelected, selectOnly, selectedBlocks, selection } from './selection';
export type { SelectionApi, SelectionState } from './selection';
export { useSelection } from './selection/hooks';
export { MAX_ZOOM, MIN_ZOOM, viewport } from './viewport';
export type { Point, ViewportApi, ViewportState } from './viewport';
export { useViewport } from './viewport/hooks';
export { clientToMm, toSpreadPoint } from './pointer';
export type { SpreadPointerEvent } from './pointer';

/* ── registries ───────────────────────────────────────────────────────────── */
export {
  DuplicateRegistrationError,
  activeTool,
  blockTypes,
  forwardPointer,
  createRegistry,
  overlays,
  panels,
  registries,
  tools,
  useActiveTool,
  useRegistry,
  views,
} from './registry';
export type {
  ActiveToolApi,
  BlockTypeDef,
  Layer,
  OverlayDef,
  PanelDef,
  Registry,
  ToolDef,
  ViewDef,
} from './registry';

/* ── storage ──────────────────────────────────────────────────────────────── */
export {
  AUTOSAVE_DEBOUNCE_MS,
  createMemoryAdapter,
  createMemorySidecarSpace,
  createSidecar,
  indexedDbAdapter,
  sidecarFactoryFor,
  startAutosave,
} from './storage';
export type {
  AutosaveHandle,
  DocumentSummary,
  SidecarFactory,
  SidecarStore,
  StorageAdapter,
} from './storage';

/* ── jobs seam ────────────────────────────────────────────────────────────── */
export {
  JobCancelledError,
  MOCK_MAX_LATENCY_MS,
  MOCK_MIN_LATENCY_MS,
  MOCK_PROGRESS_TICKS,
  applyChangeSet,
  blockIdsTouched,
  changeSetTouches,
  createMockExecutor,
  mockExecutor,
} from './jobs';
export type {
  ApplyOptions,
  ApplyResult,
  ChangeSet,
  JobExecutor,
  JobHandle,
  JobRequest,
  JobStatus,
} from './jobs';

/* ── plugin contract ──────────────────────────────────────────────────────── */
export {
  ALLOWED_PLUGIN_IMPORTS,
  FORBIDDEN_PLUGIN_IMPORTS,
  PLUGIN_ID_PATTERN,
  PluginContractError,
  assertUniqueIds,
  assertValidManifest,
  createPluginContext,
  loadPlugins,
} from './plugins';
export type {
  FlagsApi,
  LoadedPlugin,
  MaquettePlugin,
  PluginBusApi,
  PluginContext,
  PluginHost,
  PluginHostOptions,
  PluginRegistryApi,
  PluginStatus,
} from './plugins';

/* ── canvas primitives ───────────────────────────────────────────────────── */
export { BlockLayer, OverlayLayer, SpreadPaper } from './canvas';
export type {
  BlockLayerProps,
  BlockViewMode,
  OverlayLayerProps,
  SpreadPaperProps,
} from './canvas';

/* ── misc ─────────────────────────────────────────────────────────────────── */
export { disposeAll } from './dispose';
export type { Dispose } from './dispose';

/**
 * Registries — SPEC.md §4.4. These five types ARE the surface a plugin can add
 * to the application. Nothing else in the kernel renders plugin content.
 */
import type * as React from 'react';
import type { Block, Rect } from '../model/types';
import type { SpreadPointerEvent } from '../pointer';

export type Layer = 'flatplan' | 'spread' | 'both';

export interface BlockTypeDef {
  id: string;
  label: string;
  createDefault(frame: Rect): Block;
  MiniView: React.FC<{ block: Block; scale: number }>; // greeked, Layer 1
  FullView: React.FC<{ block: Block; scale: number }>; // typographic, Layer 2
  Inspector?: React.FC<{ block: Block; spreadId: string }>;
}

export interface ToolDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  layer: Layer;
  onDown?(e: SpreadPointerEvent): void;
  onMove?(e: SpreadPointerEvent): void;
  onUp?(e: SpreadPointerEvent): void;
}

/** Draws above paper in a canvas host layer. */
export interface OverlayDef {
  id: string;
  layer: Layer;
  zIndex: number;
  View: React.FC<{ spreadId: string; scale: number }>;
}

/** Docks into the shell panel slot (right ≥760px / bottom sheet). */
export interface PanelDef {
  id: string;
  title: string;
  order: number;
  View: React.FC;
  visible?: () => boolean;
}

export interface ViewDef {
  id: string;
  route: string; // e.g. /playground/x
  View: React.FC;
}

export interface Registry<T extends { id: string }> {
  register(def: T): () => void;
  list(): ReadonlyArray<T>;
  get(id: string): T | undefined;
  subscribe(cb: (defs: ReadonlyArray<T>) => void): () => void;
}

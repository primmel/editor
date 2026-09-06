// ─────────────────────────────────────────────────────────────────────
// The layers view (TODO.editor/05, slice 3) — the pure derivation
// behind the Layers panel: the package session's composition as an
// authoring surface. The stack shows who contributes what (the root
// package on top — the overlay being authored; the layers beneath it,
// nearest-winner first); the overlay table lists the terms marked
// `overlay true` with the upstream definition each supersedes (the one
// legal redefinition — composition's uses-no-redefine lifts for marked
// terms). Everything is already in the open payload; this module only
// orders and totals it.
// ─────────────────────────────────────────────────────────────────────

import type { PackageLayerInfo, PackageOpenResult, PackageOverlayInfo } from './package';

export interface LayerStackRow extends PackageLayerInfo {
  /** The package's total construct count across kinds. */
  total: number;
}

export interface LayersView {
  /** Root first (the overlay being authored), then the layers beneath,
   *  nearest-winner first (reverse merge order). */
  stack: LayerStackRow[];
  /** The overlay pairs, in merged-model order. */
  overlays: PackageOverlayInfo[];
  /** False when the package composes nothing (no imports). */
  hasLayers: boolean;
}

/** The kind census, rendered: "3 terms · 1 process" (count desc, then
 *  field asc for stability). */
export function kindCensus(layer: PackageLayerInfo): string {
  return [...layer.kinds]
    .sort((a, b) => b.constructs - a.constructs || a.field.localeCompare(b.field))
    .map((k) => `${k.constructs} ${k.field}`)
    .join(' · ');
}

export function layersView(pkg: PackageOpenResult): LayersView {
  const withTotals = pkg.layers.map((l) => ({ ...l, total: l.kinds.reduce((n, k) => n + k.constructs, 0) }));
  const root = withTotals.filter((l) => l.root);
  const rest = withTotals.filter((l) => !l.root).reverse();
  return {
    stack: [...root, ...rest],
    overlays: pkg.overlays,
    hasLayers: pkg.layers.length > 1,
  };
}

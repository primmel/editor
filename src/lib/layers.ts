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
//
// Q1 adds the copy-up verb: an upstream term (one the composition
// attributes to a layer BENEATH the root) is pulled into the root as a
// local overlay — the command flips the marker (exact undo), the
// term's working content is the seed (the merged model carries the
// nearest-upstream definition verbatim — last-write-wins already ran
// the layering resolution at open), and the save's adoption path
// (package-save.ts) writes the claimed term into the root's files.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Command } from './commands';
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

// ── Q1: the copy-up verb ("overlay this upstream term") ─────────────

/** The upstream layer a term's provenance attests — null when the term
 *  is the root's own (or unattributable). The copy-up surfaces key on
 *  this. */
export function upstreamAuthorOf(pkg: PackageOpenResult, termId: string): string | null {
  const src = pkg.provenance.constructs.terms?.[termId];
  return src?.package && src.package !== pkg.composition.root ? src.package : null;
}

/** One upstream term the root can copy up: the id, the authoring layer,
 *  and the facets the panel shows (the merged term IS the
 *  nearest-upstream definition — the composition resolved the layering
 *  at open; the overlay pairs' standalone reloads attest the same). */
export interface UpstreamTermInfo {
  id: string;
  package: string;
  label?: string;
  definition?: string;
  source?: string;
}

/** The copy-up candidates: terms authored by a layer beneath the root
 *  that the root has not claimed. Read LIVE (the caller keys on the
 *  model version) — a candidate drops out the moment the verb lands,
 *  because the marker is the claim. One honest limit: an upstream term
 *  that ITSELF carries `overlay true` (a nearer layer's overlay) is not
 *  offered — its marker is already set; claim it in the code editor
 *  (the save's adoption path keys on the flip, not on this list). */
export function upstreamTerms(pkg: PackageOpenResult, standard: Standard): UpstreamTermInfo[] {
  const out: UpstreamTermInfo[] = [];
  for (const t of standard.terms) {
    if (t.overlay === true) continue;
    const author = upstreamAuthorOf(pkg, t.id);
    if (!author) continue;
    out.push({ id: t.id, package: author, label: t.label, definition: t.definition, source: t.source });
  }
  return out;
}

/** The copy-up verb (TODO.editor Q1): pull an upstream term INTO the
 *  root package as a local overlay. The command only flips the marker —
 *  the term's working content rides along as the seed (the user tightens
 *  the reading in the inspector afterwards). The save adopts the flipped
 *  term into the root's home file; the upstream bytes are never touched.
 *  The revert is shape-exact (not updateConstruct's assign-undefined):
 *  an absent marker key is DELETED on undo, so an undone copy-up diffs
 *  clean against the baseline instead of leaving a phantom change. */
export function copyUpTerm(id: string): Command {
  let before: boolean | undefined;
  let hadKey = false;
  return {
    label: `copy up term ${id} into the local package`,
    apply(ast) {
      const t = ast.terms.find((x) => x.id === id);
      if (!t) throw new Error(`unknown construct ${id}`);
      before = t.overlay;
      hadKey = 'overlay' in t;
      t.overlay = true;
    },
    revert(ast) {
      const t = ast.terms.find((x) => x.id === id);
      if (!t) return;
      if (hadKey) t.overlay = before;
      else delete t.overlay;
    },
  };
}

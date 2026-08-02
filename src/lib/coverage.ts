// ─────────────────────────────────────────────────────────────────────
// The coverage bridge (TODO.editor/08) — the KERNEL's coverage
// calculus (mapping-coverage.ts) adapted to the mapper's canvases.
// The numbers are ALWAYS the kernel's computeCoverage output — this
// file only reshapes the report into per-node view rows (tint,
// assertion conflict, aggregation basis). Never reimplement the
// calculus here.
// ─────────────────────────────────────────────────────────────────────

import {
  buildProcessTree, collectMappings, computeCoverage, parseTargetRef,
  type CoverageLevel, type CoverageReport, type ProcessTreeNode, type Standard,
} from '@primmel/primmel';
import { profileFor } from './mapper';

export interface RefCoverageRow {
  id: string;
  /** The computed level (the kernel's verdict). */
  computed: CoverageLevel;
  directlyMapped: boolean;
  /** IMP sources mapped directly to this component. */
  mappedBy: string[];
  /** Nearest mapped ancestor when the cover is inherited. */
  inheritedFrom: string | null;
  /** The authored assertion (profile coverage block + per-pair
   *  coverage on this target), null when nothing is asserted. */
  asserted: CoverageLevel | null;
  /** asserted ≠ computed — the C23 conflict, rendered as a marker. */
  conflict: boolean;
  /** The aggregation basis for parents: the composition rule and the
   *  children's levels (rules 1–3 of the calculus, made visible). */
  composition: 'all' | 'gateway' | null;
  childLevels: { id: string; level: CoverageLevel }[];
}

export interface CoverageView {
  /** Per REF component id. */
  ref: Map<string, RefCoverageRow>;
  /** IMP side: id → mapped (a resolving pair exists). */
  impMapped: Map<string, boolean>;
  /** The raw kernel report (party numbers, unresolved pairs). */
  report: CoverageReport;
}

function indexForest(forest: ProcessTreeNode[]): Map<string, ProcessTreeNode> {
  const byId = new Map<string, ProcessTreeNode>();
  const walk = (nodes: ProcessTreeNode[]) => {
    for (const n of nodes) {
      byId.set(n.id, n);
      walk(n.children);
    }
  };
  walk(forest);
  return byId;
}

/** Compute the coverage view for one (IMP, REF, namespace) triple. */
export function coverageView(
  imp: Standard,
  ref: Standard,
  namespace: string,
): CoverageView {
  const mappings = collectMappings(imp).filter(m => m.targetModel === namespace);
  const report = computeCoverage(imp, ref, mappings, namespace);
  const forest = indexForest(buildProcessTree(ref));

  // The authored assertions: the profile's coverage block, plus any
  // per-pair coverage on pairs targeting the component.
  const profile = profileFor(imp, namespace);
  const assertedByRef = new Map<string, CoverageLevel>();
  if (profile) {
    for (const [rawRef, level] of Object.entries(profile.coverage ?? {})) {
      const t = parseTargetRef(rawRef, namespace);
      if (t.namespace === namespace) assertedByRef.set(t.id, level);
    }
    for (const pairs of Object.values(profile.mappings)) {
      for (const pair of pairs) {
        if (!pair.coverage) continue;
        const t = parseTargetRef(pair.target, namespace);
        if (t.namespace === namespace && !assertedByRef.has(t.id)) {
          assertedByRef.set(t.id, pair.coverage);
        }
      }
    }
  }

  const byId = new Map<string, RefCoverageRow>();
  for (const c of report.components) {
    const node = forest.get(c.id) ?? null;
    const asserted = assertedByRef.get(c.id) ?? null;
    byId.set(c.id, {
      id: c.id,
      computed: c.coverage,
      directlyMapped: c.directlyMapped,
      mappedBy: c.mappedBy,
      inheritedFrom: c.inheritedFrom,
      asserted,
      conflict: asserted !== null && asserted !== c.coverage,
      composition: node && node.children.length > 0 ? node.composition : null,
      childLevels: (node?.children ?? []).map(ch => ({
        id: ch.id,
        level: report.components.find(cc => cc.id === ch.id)?.coverage ?? 'none',
      })),
    });
  }

  // IMP side: mapped = a source with at least one resolving pair.
  const impMapped = new Map<string, boolean>();
  const unmapped = new Set(report.unmappedImplementation);
  for (const m of mappings) {
    impMapped.set(m.source, !unmapped.has(m.source));
  }

  return { ref: byId, impMapped, report };
}

/** The tint palette (the extension's legend): full = green, minimal =
 *  teal, partial = amber, none = slate. */
export const COVERAGE_TINTS: Record<CoverageLevel, string> = {
  full: '#7a9e5e',
  minimal: '#2f7d6b',
  partial: '#d49442',
  none: '#8a8f98',
};

/** The tooltip body: the level, how it was reached, the assertion
 *  conflict when present — the calculus's rules made visible. */
export function coverageTooltip(row: RefCoverageRow): string {
  const lines: string[] = [];
  lines.push(`coverage: ${row.computed}`);
  if (row.directlyMapped && row.mappedBy.length > 0) {
    lines.push(`mapped by: ${row.mappedBy.join(', ')}`);
  } else if (row.inheritedFrom) {
    lines.push(`inherited from ${row.inheritedFrom} (an ancestor is mapped)`);
  }
  if (row.composition && row.childLevels.length > 0) {
    const basis = row.composition === 'all'
      ? 'all children must be covered (composition: all)'
      : 'at least one branch must be covered (composition: gateway)';
    lines.push(`${basis}: ${row.childLevels.map(c => `${c.id}=${c.level}`).join(', ')}`);
  }
  if (row.conflict) {
    lines.push(`⚠ asserted ${row.asserted} but computed ${row.computed} (C23)`);
  }
  return lines.join('\n');
}

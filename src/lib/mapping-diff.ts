// ─────────────────────────────────────────────────────────────────────
// The mapping diff (G3 — the parity register): what a REFERENCE UPDATE
// does to the implementation's profile for a namespace. Per pair:
// retained (the target still resolves), broken (the target vanished in
// the new edition), or retarget (a same-name component carries the
// mapping — the suggestion, never applied silently). Plus the computed
// coverage delta between the editions (the kernel's calculus, run on
// both — never reimplemented here).
// ─────────────────────────────────────────────────────────────────────

import type { CoverageLevel, Standard } from '@primmel/primmel';
import { profileFor, splitTargetRef } from './mapper';
import { coverageView, type CoverageView } from './coverage';

export interface MappingPairDelta {
  source: string;
  targetId: string;
  status: 'retained' | 'broken' | 'retarget';
  /** The retarget suggestion: the new edition's id bearing the same
   *  name. */
  suggestedTarget?: string;
}

export interface CoverageTally {
  full: number;
  minimal: number;
  partial: number;
  none: number;
}

export interface MappingDiff {
  namespace: string;
  pairs: MappingPairDelta[];
  coverage: { before: CoverageTally; after: CoverageTally };
}

/** The name index for retarget suggestions — the collections the
 *  corpus actually pairs. A SUGGESTION engine, not the automap. */
function nameIndex(ref: Standard): Map<string, string> {
  const out = new Map<string, string>();
  const add = (items: ReadonlyArray<{ id: string; name?: string; title?: string }> | undefined) => {
    for (const i of items ?? []) {
      const label = (i.name ?? i.title ?? '').trim().toLowerCase();
      if (label && !out.has(label)) out.set(label, i.id);
    }
  };
  add(ref.processes);
  add(ref.requirements);
  add(ref.dataclasses);
  add(ref.terms);
  return out;
}

function tally(view: CoverageView): CoverageTally {
  const t: CoverageTally = { full: 0, minimal: 0, partial: 0, none: 0 };
  for (const row of view.ref.values()) t[row.computed]++;
  return t;
}

export function mappingDiff(
  imp: Standard,
  oldRef: Standard,
  newRef: Standard,
  namespace: string,
): MappingDiff {
  const profile = profileFor(imp, namespace);
  const ids = new Set([...(newRef.processes ?? []), ...(newRef.requirements ?? []), ...(newRef.dataclasses ?? []), ...(newRef.terms ?? [])].map((c) => c.id));
  const names = nameIndex(newRef);
  const pairs: MappingPairDelta[] = [];
  const seenSources = new Set<string>();
  for (const [source, list] of Object.entries(profile?.mappings ?? {})) {
    seenSources.add(source);
    for (const pair of list) {
      const t = splitTargetRef(pair.target);
      if (!t || t.namespace !== namespace) continue;
      if (ids.has(t.id)) {
        pairs.push({ source, targetId: t.id, status: 'retained' });
        continue;
      }
      // The old target's name, looked up in the new edition.
      const oldEntry = [...(oldRef.processes ?? []), ...(oldRef.requirements ?? []), ...(oldRef.dataclasses ?? []), ...(oldRef.terms ?? [])].find((c) => c.id === t.id) as { name?: string; title?: string } | undefined;
      const label = (oldEntry?.name ?? oldEntry?.title ?? '').trim().toLowerCase();
      const suggested = label ? names.get(label) : undefined;
      pairs.push({
        source,
        targetId: t.id,
        status: 'broken',
        ...(suggested ? { suggestedTarget: suggested } : {}),
      });
    }
  }
  return {
    namespace,
    pairs,
    coverage: {
      before: tally(coverageView(imp, oldRef, namespace)),
      after: tally(coverageView(imp, newRef, namespace)),
    },
  };
}

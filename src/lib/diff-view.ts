// ─────────────────────────────────────────────────────────────────────
// The diff bridge (TODO.editor/12) — the kernel's model-diff output
// reshaped into the view model: per-element status rows with the
// facet-level before/after (the elementIndex's canonical aspects),
// plus the mapping diff. The comparison itself is ALWAYS the kernel's
// diffStandards — never a Studio-side reimplementation.
// ─────────────────────────────────────────────────────────────────────

import {
  diffStandards, elementIndex,
  type DiffElement, type MappingDiff, type ModelDiff, type Standard, type TierName,
} from '@primmel/primmel';

export type DiffStatus = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged';

export interface FacetChange {
  aspect: string;
  before: string | null;
  after: string | null;
}

export interface DiffRow {
  key: string;
  id: string;
  kind: string;
  tier: TierName;
  status: DiffStatus;
  /** changed/moved rows: the facet-level before/after. */
  facets: FacetChange[];
  /** moved rows: the anchor transition (the kernel's wording). */
  move?: { from: string; to: string };
}

export interface DiffViewModel {
  diff: ModelDiff;
  rows: DiffRow[];
  /** Status → rows (the grouped list). */
  byStatus: Record<DiffStatus, DiffRow[]>;
  /** Element key → status (the canvas tint). */
  statusOf: Map<string, DiffStatus>;
  mappings: MappingDiff;
}

/** The comparison — the kernel's diffStandards, indexed both ways for
 *  the facet before/after. */
export function diffView(a: Standard, b: Standard, options: { aLabel?: string; bLabel?: string } = {}): DiffViewModel {
  const diff = diffStandards(a, b, options);
  const dup: string[] = [];
  const indexA = elementIndex(a, dup);
  const indexB = elementIndex(b, dup);

  const facetsOf = (key: string, changedAspects: string[]): FacetChange[] => {
    const elA = indexA.get(key) as DiffElement | undefined;
    const elB = indexB.get(key) as DiffElement | undefined;
    return changedAspects.map(aspect => ({
      aspect,
      before: elA?.aspects[aspect] ?? null,
      after: elB?.aspects[aspect] ?? null,
    }));
  };

  const rows: DiffRow[] = [
    ...diff.added.map(e => ({
      key: e.key, id: e.id, kind: e.kind, tier: e.tier, status: 'added' as const,
      facets: Object.entries(indexB.get(e.key)?.aspects ?? {}).map(([aspect, after]) => ({
        aspect, before: null, after,
      })),
    })),
    ...diff.removed.map(e => ({
      key: e.key, id: e.id, kind: e.kind, tier: e.tier, status: 'removed' as const,
      facets: Object.entries(indexA.get(e.key)?.aspects ?? {}).map(([aspect, before]) => ({
        aspect, before, after: null,
      })),
    })),
    ...diff.changed.map(e => ({
      key: e.key, id: e.id, kind: e.kind, tier: e.tier, status: 'changed' as const,
      facets: facetsOf(e.key, e.aspects),
    })),
    ...diff.moved.map(e => ({
      key: e.key, id: e.id, kind: e.kind, tier: e.tier, status: 'moved' as const,
      facets: facetsOf(e.key, ['anchor']),
      move: { from: e.from, to: e.to },
    })),
  ];

  const byStatus: Record<DiffStatus, DiffRow[]> = {
    added: [], removed: [], changed: [], moved: [], unchanged: [],
  };
  const statusOf = new Map<string, DiffStatus>();
  for (const row of rows) {
    byStatus[row.status].push(row);
    statusOf.set(row.key, row.status);
  }

  return { diff, rows, byStatus, statusOf, mappings: diff.mappings };
}

/** The status palette (added green, removed red, changed amber, moved
 *  blue, unchanged slate). */
export const DIFF_TINTS: Record<DiffStatus, string> = {
  added: '#7a9e5e',
  removed: '#b85555',
  changed: '#d49442',
  moved: '#5b6bc0',
  unchanged: '#8a8f98',
};

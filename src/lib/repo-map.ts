// ─────────────────────────────────────────────────────────────────────
// The repo map (G2 — the parity register): the workspace's mapping
// inventory — every registered reference with its pair count and
// coverage over the implementation's mappable elements, MAPPED OR NOT
// (a registered reference with zero pairs is inventory, not absence).
// Pure read; the panel renders it.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { mappableIds, mappedSourceIds } from './mapper';

export interface RepoMapRow {
  namespace: string;
  pairs: number;
  mappedSources: number;
  mappableSources: number;
}

function rowFor(model: Standard, ns: string, mappable: number): RepoMapRow {
  const profile = model.mapProfiles.find((p) => p.namespace === ns) ?? null;
  return {
    namespace: ns,
    pairs: profile
      ? Object.values(profile.mappings).reduce((n, list) => n + list.length, 0)
      : 0,
    mappedSources: profile ? mappedSourceIds(profile).size : 0,
    mappableSources: mappable,
  };
}

/** The repo map over the mapping registry's namespaces (plus any
 *  profile whose reference is not currently registered — the pairs
 *  exist even when the ref model is closed). */
export function repoMap(model: Standard, refNamespaces: string[]): RepoMapRow[] {
  const mappable = mappableIds(model).length;
  const seen = new Set(refNamespaces);
  const rows = refNamespaces.map((ns) => rowFor(model, ns, mappable));
  for (const p of model.mapProfiles) {
    if (!seen.has(p.namespace)) {
      seen.add(p.namespace);
      rows.push(rowFor(model, p.namespace, mappable));
    }
  }
  return rows;
}

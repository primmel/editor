// ─────────────────────────────────────────────────────────────────────
// G15 — the edition-crossed map profiles: the 13485 fixture's story.
// One implementation's map profiles read across TWO EDITIONS of the
// reference (the 2016 and the 2021 .prm map sets): which pairs
// carried, which arrived, which dropped — the directives→regulations
// migration the fixture itself records. Pure read over the kernel's
// PrmFile.
// ─────────────────────────────────────────────────────────────────────

import type { PrmFile } from '@primmel/primmel';

export interface PairKey {
  source: string;
  target: string;
}

export interface EditionNamespaceDelta {
  namespace: string;
  carried: PairKey[];
  added: PairKey[];
  dropped: PairKey[];
}

function pairsOf(file: PrmFile, namespace: string): Map<string, PairKey> {
  const out = new Map<string, PairKey>();
  const entry = file.mapSet[namespace];
  if (!entry) return out;
  for (const [source, byTarget] of Object.entries(entry.mappings)) {
    for (const target of Object.keys(byTarget)) {
      out.set(`${source}→${target}`, { source, target });
    }
  }
  return out;
}

/** The namespaces present in either edition (sorted, stable). */
export function editionNamespaces(a: PrmFile, b: PrmFile): string[] {
  return [...new Set([...Object.keys(a.mapSet), ...Object.keys(b.mapSet)])].sort();
}

/** The pair delta per namespace, old edition → new edition. */
export function editionProfileDiff(a: PrmFile, b: PrmFile): EditionNamespaceDelta[] {
  return editionNamespaces(a, b).map((namespace) => {
    const oldPairs = pairsOf(a, namespace);
    const newPairs = pairsOf(b, namespace);
    const carried: PairKey[] = [];
    const added: PairKey[] = [];
    const dropped: PairKey[] = [];
    for (const [key, pair] of newPairs) {
      if (oldPairs.has(key)) carried.push(pair);
      else added.push(pair);
    }
    for (const [key, pair] of oldPairs) {
      if (!newPairs.has(key)) dropped.push(pair);
    }
    return { namespace, carried, added, dropped };
  });
}

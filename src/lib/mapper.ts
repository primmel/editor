// ─────────────────────────────────────────────────────────────────────
// The mapper library (TODO.editor/07) — pure queries over the v3
// MapProfile (`mappings: Record<sourceId, MappingPair[]>`): the
// mappable universe (the KERNEL's componentIds — never a local list),
// partner lookups both directions, the mapped/unmapped party lists.
// No DOM, no commands (pair CRUD lives in commands.ts).
// ─────────────────────────────────────────────────────────────────────

import { componentIds, type MapProfile, type MappingPair, type Standard } from '@primmel/primmel';

/** The reference target form: `<namespace>#<elementId>`. */
export function targetRef(namespace: string, elementId: string): string {
  return `${namespace}#${elementId}`;
}

/** Split a target ref (the inverse of targetRef); null when malformed. */
export function splitTargetRef(target: string): { namespace: string; id: string } | null {
  const i = target.indexOf('#');
  if (i <= 0 || i === target.length - 1) return null;
  return { namespace: target.slice(0, i), id: target.slice(i + 1) };
}

/** The mappable universe of a model — the kernel's coverage universe,
 *  sorted for stable display. */
export function mappableIds(model: Standard): string[] {
  return [...componentIds(model)].sort();
}

/** The model's profile for a reference namespace (null when the model
 *  has never mapped to it). */
export function profileFor(model: Standard, namespace: string): MapProfile | null {
  return model.mapProfiles.find(p => p.namespace === namespace) ?? null;
}

/** The pairs a source (IMP side) holds. */
export function pairsOf(profile: MapProfile | null, sourceId: string): MappingPair[] {
  return profile?.mappings[sourceId] ?? [];
}

/** The sources targeting a given ref element (the reverse lookup). */
export function sourcesTargeting(profile: MapProfile | null, refId: string): string[] {
  if (!profile) return [];
  const out: string[] = [];
  for (const [source, pairs] of Object.entries(profile.mappings)) {
    for (const pair of pairs) {
      const t = splitTargetRef(pair.target);
      if (t?.id === refId && t.namespace === profile.namespace) out.push(source);
    }
  }
  return out.sort();
}

/** The mapped source ids (IMP side). */
export function mappedSourceIds(profile: MapProfile | null): Set<string> {
  const out = new Set<string>();
  if (!profile) return out;
  for (const [source, pairs] of Object.entries(profile.mappings)) {
    if (pairs.length > 0) out.add(source);
  }
  return out;
}

/** The mapped target ids (REF side, bare element ids). */
export function mappedTargetIds(profile: MapProfile | null): Set<string> {
  const out = new Set<string>();
  if (!profile) return out;
  for (const pairs of Object.values(profile.mappings)) {
    for (const pair of pairs) {
      const t = splitTargetRef(pair.target);
      if (t?.namespace === profile.namespace) out.add(t.id);
    }
  }
  return out;
}

/** The unmapped party list, IMP side. */
export function unmappedSources(model: Standard, profile: MapProfile | null): string[] {
  const mapped = mappedSourceIds(profile);
  return mappableIds(model).filter(id => !mapped.has(id));
}

/** The unmapped party list, REF side. */
export function unmappedTargets(refModel: Standard, profile: MapProfile | null): string[] {
  const mapped = mappedTargetIds(profile);
  return mappableIds(refModel).filter(id => !mapped.has(id));
}

/** Every (source, pair) flat row — the overlay edge list's input. */
export function allPairs(profile: MapProfile | null): { source: string; pair: MappingPair }[] {
  if (!profile) return [];
  const out: { source: string; pair: MappingPair }[] = [];
  for (const [source, pairs] of Object.entries(profile.mappings)) {
    for (const pair of pairs) out.push({ source, pair });
  }
  return out;
}

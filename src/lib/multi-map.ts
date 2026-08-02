// ─────────────────────────────────────────────────────────────────────
// Multi-reference mapping (TODO.editor/09) — one IMP against several
// REF standards (the integrated-management-system story): a MapProfile
// per reference namespace, the lens switcher, cross-profile badges,
// and the seed command ("start 27001 from the 9001 mappings" — pairs
// carry over only where the target resolves; the rest is a review
// list, never silent).
// ─────────────────────────────────────────────────────────────────────

import { componentIds, type Standard } from '@primmel/primmel';
import type { Command } from './commands';
import { splitTargetRef, targetRef } from './mapper';

/** The namespaces an IMP element maps into (the cross-profile badges). */
export function namespacesOf(model: Standard, impId: string): string[] {
  return model.mapProfiles
    .filter(p => (p.mappings[impId] ?? []).length > 0)
    .map(p => p.namespace)
    .sort();
}

/** Every IMP element id mapped in at least one profile → its badges. */
export function badgeMap(model: Standard): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const profile of model.mapProfiles) {
    for (const [source, pairs] of Object.entries(profile.mappings)) {
      if (pairs.length === 0) continue;
      const list = out.get(source) ?? [];
      if (!list.includes(profile.namespace)) list.push(profile.namespace);
      out.set(source, list);
    }
  }
  for (const list of out.values()) list.sort();
  return out;
}

export interface SeedOutcome {
  /** Pairs carried into the new profile. */
  carried: number;
  /** Pairs that did NOT carry (the target id is absent from the target
   *  reference) — the review list, in `source ⇒ target` form. */
  review: string[];
}

/** Seed a fresh profile for `targetNs` from the pairs of `sourceNs`:
 *  a pair carries over (retargeted to the target namespace) only when
 *  its bare target id resolves in the target reference model; the rest
 *  fill the review list. One command — the whole seed is one undo
 *  unit. The outcome is readable after `apply`. */
export function seedProfileFrom(
  sourceNs: string,
  targetNs: string,
  targetRefModel: Standard,
): { command: Command; outcome: SeedOutcome } {
  const outcome: SeedOutcome = { carried: 0, review: [] };
  const targetIds = new Set([...componentIds(targetRefModel)]);
  const command: Command = {
    label: `seed ${targetNs} from ${sourceNs}`,
    apply(ast) {
      const sourceProfile = ast.mapProfiles.find(p => p.namespace === sourceNs);
      if (!sourceProfile) throw new Error(`no profile for ${sourceNs}`);
      if (ast.mapProfiles.some(p => p.namespace === targetNs)) {
        throw new Error(`${targetNs} already has a profile`);
      }
      const profile = {
        namespace: targetNs,
        description: `seeded from ${sourceNs} — review the unmatched list`,
        mappings: {} as Record<string, { target: string; description: string; justification: string; coverage: '' | 'full' | 'minimal' | 'partial' | 'none' }[]>,
        coverage: {},
      };
      outcome.carried = 0;
      outcome.review = [];
      for (const [source, pairs] of Object.entries(sourceProfile.mappings)) {
        for (const pair of pairs) {
          const t = splitTargetRef(pair.target);
          if (t && targetIds.has(t.id)) {
            (profile.mappings[source] ??= []).push({
              target: targetRef(targetNs, t.id),
              description: pair.description,
              justification: pair.justification,
              coverage: pair.coverage,
            });
            outcome.carried++;
          } else {
            outcome.review.push(`${source} ⇒ ${pair.target}`);
          }
        }
      }
      ast.mapProfiles.push(profile as never);
    },
    revert(ast) {
      const i = ast.mapProfiles.findIndex(p => p.namespace === targetNs);
      if (i >= 0) ast.mapProfiles.splice(i, 1);
    },
  };
  return { command, outcome };
}

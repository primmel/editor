// ─────────────────────────────────────────────────────────────────────
// G1 — the transitive/inherited discovery bridge: the KERNEL's
// discoverTransitive over the whole mapping registry — the
// implementation's profiles AND every registered reference's own
// profiles (a reference that implements another reference bridges the
// hop). Proposals only; a human confirms. Pure read.
// ─────────────────────────────────────────────────────────────────────

import type { DiscoveryProposal, Standard } from '@primmel/primmel';
import { collectMappings, discoverTransitive } from '@primmel/primmel';

export function transitiveProposals(
  imp: Standard,
  refs: Record<string, Standard>,
  targetNamespace: string,
): DiscoveryProposal[] {
  const impNs = imp.meta?.namespace?.trim() ?? '';
  const models = [{ modelId: impNs, mappings: collectMappings(imp) }];
  for (const [ns, ref] of Object.entries(refs)) {
    models.push({ modelId: ns, mappings: collectMappings(ref, { modelId: ns }) });
  }
  return discoverTransitive(models).filter(
    (p) => p.sourceModel === impNs && p.targetModel === targetNamespace,
  );
}

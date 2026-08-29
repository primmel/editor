// ─────────────────────────────────────────────────────────────────────
// The compliance surface (TODO.editor wave 03, audit PROGRESS/39 G6) —
// the provision-era panels bridged to v3 content. A legacy model's
// compliance list is its provisions (SHALL/SHOULD/MAY modality); a v3
// package has zero provisions and carries its normative force in the
// requirements (shall/should/may obligation). This helper is the ONE
// read: the panel, the stats pill, and the code status line all render
// the same surface instead of misreading v3 content as empty.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';

export interface ComplianceRow {
  id: string;
  /** The modality (SHALL) or obligation (shall) chip. */
  modality: string;
  /** The row's secondary text (the requirement's name). */
  detail?: string;
}

export interface ComplianceSurface {
  /** Which collection the surface read — provisions (legacy) or
   *  requirements (v3). */
  kind: 'provisions' | 'requirements';
  /** The stat label ('provisions' | 'requirements'). */
  label: string;
  rows: ComplianceRow[];
  /** The filter chips (first entry is the all-filter). */
  modalities: string[];
}

/** The compliance surface for a model: provisions when the model carries
 *  any (the legacy path, unchanged), else the requirements (the v3
 *  path). An empty model reads as provisions with zero rows. */
export function complianceSurface(model: Standard): ComplianceSurface {
  if (model.provisions.length > 0 || model.requirements.length === 0) {
    return {
      kind: 'provisions',
      label: 'provisions',
      rows: model.provisions.map(p => ({ id: p.id, modality: p.modality })),
      modalities: ['all', 'SHALL', 'SHOULD', 'MAY'],
    };
  }
  const obligations = ['all', ...new Set(model.requirements.map(r => r.obligation || 'shall'))];
  return {
    kind: 'requirements',
    label: 'requirements',
    rows: model.requirements.map(r => ({ id: r.id, modality: r.obligation || 'shall', detail: r.name })),
    modalities: obligations,
  };
}

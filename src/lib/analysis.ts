// ─────────────────────────────────────────────────────────────────────
// The analysis plane (the gap pack — G7/G8/G9/G10): the assessor's
// four worksheets as pure derivations over the model, typed from the
// kernel's own shapes.
//
//   G9  registry summaries   — each registry, its paired class, the
//                              attribute form, the store name
//   G10 provision summaries  — each provision's condition, its subject
//                              claims, its citations, + the CSV export
//   G8  the link inventory   — every internal cross-reference with its
//                              resolution state (the analyser)
//   G7  the checklist        — the requirements to self-assess (the
//                              marks live in the checklist store —
//                              ephemeral, never the AST)
// ─────────────────────────────────────────────────────────────────────

import { componentIds, type Standard } from '@primmel/primmel';

// ── G9 — the registry summaries ──────────────────────────────────────

export interface RegistryAttribute {
  id: string;
  type: string;
  cardinality: string;
  definition: string;
}

export interface RegistrySummary {
  id: string;
  title: string;
  classId: string | null;
  store: string | null;
  attributes: RegistryAttribute[];
  /** The formless diagnostic (C157's own words) when unpaired. */
  formless: boolean;
}

export function registrySummaries(model: Standard): RegistrySummary[] {
  const byId = new Map((model.dataclasses ?? []).map((c) => [c.id, c]));
  return (model.regs ?? []).map((r) => {
    if (!r.data) {
      return {
        id: r.id, title: r.title, classId: null,
        store: null, attributes: [], formless: true,
      };
    }
    // extends chains merge, parent first (the workspace-data rule).
    const chain: string[] = [];
    let cur: string | null = r.data.id;
    while (cur && !chain.includes(cur)) {
      chain.unshift(cur);
      cur = byId.get(cur)?.extends ?? null;
    }
    const attributes: RegistryAttribute[] = [];
    const seen = new Set<string>();
    for (const classId of chain) {
      const cls = byId.get(classId);
      if (!cls) continue;
      for (const a of cls.attributes ?? []) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        attributes.push({ id: a.id, type: a.type, cardinality: a.cardinality, definition: a.definition });
      }
    }
    return {
      id: r.id,
      title: r.title,
      classId: r.data.id,
      store: byId.get(r.data.id)?.store ?? null,
      attributes,
      formless: false,
    };
  });
}

// ── G10 — the provision summaries + the export ───────────────────────

export interface ProvisionSummary {
  id: string;
  modality: string;
  condition: string;
  /** The subject claims (`slot: entityId`) the provision makes. */
  subjects: string[];
  /** The citations (document + clause). */
  citations: string[];
}

export function provisionSummaries(model: Standard): ProvisionSummary[] {
  return (model.provisions ?? []).map((p) => ({
    id: p.id,
    modality: p.modality,
    condition: p.condition,
    subjects: [...p.subject.entries()].map(([slot, entityId]) => `${slot}: ${entityId}`),
    citations: [...(p.referenceIds ?? [])],
  }));
}

/** The G10 export: the provision summary as CSV (the assessor's
 *  importable form). */
export function provisionCsv(summaries: ProvisionSummary[]): string {
  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines = ['provision,modality,condition,subjects,citations'];
  for (const p of summaries) {
    lines.push([
      esc(p.id), esc(p.modality), esc(p.condition),
      esc(p.subjects.join('; ')), esc(p.citations.join('; ')),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

// ── G8 — the link inventory (the analyser) ───────────────────────────

export interface ModelLink {
  sourceKind: string;
  sourceId: string;
  predicate: string;
  targetId: string;
  resolved: boolean;
}

/** Every internal cross-reference the model declares, with its
 *  resolution state — the analyser's inventory (the kernel's checks
 *  judge the severities; this lists the edges). */
export function linkInventory(model: Standard): ModelLink[] {
  const known = componentIds(model);
  const links: ModelLink[] = [];
  const push = (sourceKind: string, sourceId: string, predicate: string, targetId: string) => {
    if (!targetId) return;
    links.push({ sourceKind, sourceId, predicate, targetId, resolved: known.has(targetId) });
  };
  for (const r of model.requirements ?? []) {
    for (const b of r.bindsTo ?? []) push('requirement', r.id, 'binds-to', b);
    for (const s of r.subjects ?? []) push('requirement', r.id, 'verifies', s.entityId);
  }
  for (const p of model.provisions ?? []) {
    for (const [, entityId] of p.subject.entries()) push('provision', p.id, 'claims', entityId);
  }
  return links;
}

// ── G7 — the checklist ───────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  statement: string;
  clause: string | null;
}

/** The self-assessment worksheet: every requirement with its
 *  statement and provenance clause. The marks live in the checklist
 *  store — ephemeral until exported. */
export function checklistOf(model: Standard): ChecklistItem[] {
  return (model.requirements ?? []).map((r) => {
    const clause = r.sourceRefs?.find((s) => s.clause)?.clause ?? null;
    return { id: r.id, statement: r.statement, clause };
  });
}

export type ChecklistMark = 'satisfied' | 'partial' | 'not-evidenced';

/** The checklist export: the assessor's CSV (marks + evidence). */
export function checklistCsv(
  items: ChecklistItem[],
  marks: Record<string, { mark: ChecklistMark; evidence: string }>,
): string {
  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines = ['requirement,statement,mark,evidence'];
  for (const item of items) {
    const m = marks[item.id];
    lines.push([esc(item.id), esc(item.statement), esc(m?.mark ?? 'unmarked'), esc(m?.evidence ?? '')].join(','));
  }
  return `${lines.join('\n')}\n`;
}

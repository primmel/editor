// ─────────────────────────────────────────────────────────────────────
// The workspace data plane (G13 step 2 — the registry instance store):
// the rows live in the package as an ordinary data file
// (workspace/instances.json — the substrate decision: instance data
// rides the package, the save commits it). The SCHEMA is the model's
// own: the registry's paired dataclass (C157's pairing) drives the
// form — the fields are the class's attributes (extends merges).
// Pure functions + the dev-server read/save clients.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';

export interface WorkspaceRow {
  id: string;
  values: Record<string, string>;
}

export interface WorkspaceDoc {
  registries: Record<string, WorkspaceRow[]>;
}

export const WORKSPACE_PATH = 'workspace/instances.json';

export function emptyWorkspace(): WorkspaceDoc {
  return { registries: {} };
}

export function parseWorkspace(text: string): WorkspaceDoc {
  const doc = JSON.parse(text) as Partial<WorkspaceDoc>;
  if (!doc || typeof doc !== 'object' || typeof doc.registries !== 'object' || doc.registries === null) {
    throw new Error('the workspace file carries no registries object');
  }
  return { registries: doc.registries };
}

export function serializeWorkspace(doc: WorkspaceDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export interface WorkspaceField {
  id: string;
  type: string;
  cardinality: string;
  definition: string;
}

export interface WorkspaceSchema {
  registryId: string;
  classId: string;
  fields: WorkspaceField[];
}

/** The form schema for a registry: the paired dataclass's attributes
 *  (extends chains merge, parent first). The registry without a
 *  resolving pairing is formless — C157's own diagnostic. */
export function schemaOf(standard: Standard, registryId: string): WorkspaceSchema {
  const registry = (standard.regs ?? []).find((r) => r.id === registryId);
  if (!registry) throw new Error(`no registry ${registryId}`);
  if (!registry.data) {
    throw new Error(`registry ${registryId} pairs no dataclass — the registry is formless (C157)`);
  }
  const byId = new Map((standard.dataclasses ?? []).map((c) => [c.id, c]));
  const chain: string[] = [];
  let cur: string | null = registry.data.id;
  while (cur && !chain.includes(cur)) {
    chain.unshift(cur);
    cur = byId.get(cur)?.extends ?? null;
  }
  const fields: WorkspaceField[] = [];
  const seen = new Set<string>();
  for (const classId of chain) {
    const cls = byId.get(classId);
    if (!cls) continue;
    for (const a of cls.attributes ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      fields.push({ id: a.id, type: a.type, cardinality: a.cardinality, definition: a.definition });
    }
  }
  return { registryId, classId: registry.data.id, fields };
}

// ── The dev-server clients ───────────────────────────────────────────

/** Read a package file (404 → null — a package without workspace data
 *  yet). */
export async function fetchPackageFile(dir: string, path: string): Promise<string | null> {
  const res = await fetch('/api/package/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir, path }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return ((await res.json()) as { text: string }).text;
}

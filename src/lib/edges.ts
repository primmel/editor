// ─────────────────────────────────────────────────────────────────────
// The edge/connect logic (TODO.editor/02) — pure: which connections
// are legal, the edge-id mint, the condition discipline. No DOM.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Edge, Subprocess } from './commands';

/** Elements of a page (names) — resolved or raw shapes normalized. */
export function pageChildNames(page: Subprocess): string[] {
  return (page.childs ?? []).map(c => c.name);
}

/** Data components of a page (the dashed data-link section). */
export function pageDataNames(page: Subprocess): string[] {
  return (page.data ?? []).map(c => c.name);
}

/** Is `name` placeable on `page` (i.e. edge-connectable)? */
export function isOnPage(page: Subprocess, name: string): boolean {
  return pageChildNames(page).includes(name);
}

/** An edge's endpoint ids (resolved component or raw relations). */
export function edgeEnds(e: Edge): { from?: string; to?: string } {
  const rel = (e as unknown as { _relations?: { from?: string; to?: string } })._relations;
  const comFrom = e.from as { name?: string; element?: { id?: string } | null } | null;
  const comTo = e.to as { name?: string; element?: { id?: string } | null } | null;
  return {
    from: comFrom?.element?.id ?? comFrom?.name ?? rel?.from,
    to: comTo?.element?.id ?? comTo?.name ?? rel?.to,
  };
}

export type ConnectionError =
  | 'same-node'
  | 'endpoint-missing'
  | 'duplicate-edge'
  | 'cross-page';

/** The connection discipline (the MMEL extension's rules, ported):
 *  - never a self-loop on the same node;
 *  - both endpoints must be on the SAME page (cross-page edges are
 *    forbidden — communication flows through the subprocess node);
 *  - no exact duplicate (same from + to + condition);
 *  - data-link endpoints (a data node ↔ a process) connect through the
 *    data section, allowed across the process/data seam on one page. */
export function canConnect(
  page: Subprocess,
  fromId: string,
  toId: string,
  condition = '',
): { ok: true } | { ok: false; reason: ConnectionError } {
  if (fromId === toId) return { ok: false, reason: 'same-node' };
  const fromOk = isOnPage(page, fromId) || pageDataNames(page).includes(fromId);
  const toOk = isOnPage(page, toId) || pageDataNames(page).includes(toId);
  if (!fromOk || !toOk) return { ok: false, reason: 'endpoint-missing' };
  const dup = (page.edges ?? []).some(e => {
    const ends = edgeEnds(e);
    return ends.from === fromId && ends.to === toId && (e.condition ?? '') === condition;
  });
  if (dup) return { ok: false, reason: 'duplicate-edge' };
  return { ok: true };
}

/** Mint the smallest free edge id (`E{n}`) on a page. */
export function mintEdgeId(page: Subprocess): string {
  const taken = new Set((page.edges ?? []).map(e => e.id));
  for (let n = 1; ; n++) {
    const id = `E${n}`;
    if (!taken.has(id)) return id;
  }
}

/** Find the page a subprocess-node links to (double-click navigation):
 *  a process with `page` set descends there; a subprocess page IS it. */
export function pageForNode(model: Standard, nodeId: string): string | null {
  if (model.pages.some(p => p.id === nodeId)) return nodeId;
  const proc = model.processes.find(p => p.id === nodeId);
  const page = (proc?.page as { id?: string } | null);
  if (page?.id && model.pages.some(p => p.id === page.id)) return page.id;
  return null;
}

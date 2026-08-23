import type { Standard } from '@primmel/primmel';
import type { Canvas } from './render';

const SPACING_X = 160;
const SPACING_Y = 100;

function compId(c: { element?: { id: string } | null; name: string }): string {
  return c.element?.id ?? c.name;
}

export function autoLayout(canvas: Canvas, model: Standard): void {
  if (!canvas.childs) return;

  const startEvents = canvas.childs.filter((c) => {
    const el = compId(c);
    return model.events.find((e) => e.id === el && e.eventType === 'start');
  });

  if (startEvents.length === 0) {
    canvas.childs.forEach((c, i) => {
      c.x = 0;
      c.y = i * SPACING_Y;
    });
    return;
  }

  const visited = new Set<string>();
  const levels = new Map<string, number>();

  function getLevel(elementId: string, depth: number): void {
    if (visited.has(elementId)) return;
    if (depth > 20) return;
    visited.add(elementId);
    levels.set(elementId, depth);

    const outgoing = (canvas.edges ?? []).filter((e) => {
      const from = e.from?.element?.id ?? e.from?.name;
      return from === elementId;
    });
    for (const edge of outgoing) {
      const target = edge.to?.element?.id ?? edge.to?.name;
      if (target && !visited.has(target)) {
        getLevel(target, depth + 1);
      }
    }
  }

  for (const start of startEvents) {
    const el = compId(start);
    getLevel(el, 0);
  }

  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(id);
  }

  for (const c of canvas.childs) {
    const el = compId(c);
    const level = levels.get(el);
    if (level === undefined) continue;
    const siblings = byLevel.get(level) ?? [];
    const idx = siblings.indexOf(el);
    c.x = level * SPACING_X;
    c.y = idx * SPACING_Y;
  }
}

/**
 * The viewer's layout pass (Wave 4, the read-only mount): pages whose
 * components carry NO authored layout get one autoLayout walk. The
 * parser defaults missing x/y to 0, so "unpositioned" reads as every
 * component stacked at the origin — never an authored arrangement. A
 * page with any off-origin component is left exactly as written (mixed
 * pages are an authoring act in progress, not the viewer's call), as is
 * the single-component page (one node at the origin renders fine).
 * In memory only — persisting positions back into files stays an
 * authoring act, out of the viewer's scope. Returns the pages laid out.
 */
export function autoLayoutUnpositioned(model: Standard): number {
  let laidOut = 0;
  for (const page of model.pages) {
    const childs = page.childs ?? [];
    const data = page.data ?? [];
    if (childs.length + data.length < 2) continue;
    const allAtOrigin = [...childs, ...data].every(
      (c) => (c.x ?? 0) === 0 && (c.y ?? 0) === 0,
    );
    if (!allAtOrigin) continue;
    autoLayout(page, model);
    // autoLayout walks the flow childs only; the data section stacks in
    // a column right of the laid-out flow.
    if (data.length > 0) {
      const columnX = childs.length
        ? Math.max(...childs.map((c) => c.x ?? 0)) + SPACING_X
        : 0;
      data.forEach((c, i) => {
        c.x = columnX;
        c.y = i * SPACING_Y;
      });
    }
    laidOut++;
  }
  return laidOut;
}

export { SPACING_X, SPACING_Y };

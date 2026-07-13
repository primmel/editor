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

export { SPACING_X, SPACING_Y };

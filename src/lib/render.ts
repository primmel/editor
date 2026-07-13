import type { Standard } from '@primmel/primmel';

type Canvas = Standard['pages'][number];

export interface RenderNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label: string;
}

export interface RenderEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
}

export type NodeKind =
  | 'start_event' | 'end_event' | 'timer_event'
  | 'process' | 'exclusive_gateway' | 'parallel_gateway';

const NODE_SIZE = 56;
const HALF = NODE_SIZE / 2;

export function extractCanvas(model: Standard, canvasId: string | null): Canvas | null {
  if (!canvasId) {
    const root = model.pages.find((p) => p.id === model.root?.id);
    return root ?? model.pages[0] ?? null;
  }
  return model.pages.find((p) => p.id === canvasId) ?? null;
}

function resolveNodeKind(model: Standard, elementId: string): NodeKind {
  const ev = model.events.find((e) => e.id === elementId);
  if (ev) {
    if (ev.eventType === 'start') return 'start_event';
    if (ev.eventType === 'end') return 'end_event';
    return 'timer_event';
  }
  const gw = model.gateways.find((g) => g.id === elementId);
  if (gw) {
    return gw.gatewayType === 'exclusive_gateway' ? 'exclusive_gateway' : 'parallel_gateway';
  }
  return 'process';
}

function resolveLabel(model: Standard, elementId: string): string {
  const proc = model.processes.find((p) => p.id === elementId);
  if (proc) return proc.name || proc.id;
  return elementId;
}

export function renderCanvas(model: Standard, canvas: Canvas | null): {
  nodes: RenderNode[];
  edges: RenderEdge[];
} {
  if (!canvas || !canvas.childs) return { nodes: [], edges: [] };

  const nodes: RenderNode[] = canvas.childs.map((c) => ({
    id: c.element?.id ?? c.name,
    x: c.x ?? 0,
    y: c.y ?? 0,
    kind: resolveNodeKind(model, c.element?.id ?? c.name),
    label: resolveLabel(model, c.element?.id ?? c.name),
  }));

  const lookup = new Map(nodes.map((n) => [n.id, n]));
  const edges: RenderEdge[] = (canvas.edges ?? [])
    .map((e) => {
      const fromId = e.from?.element?.id ?? e.from?.name ?? '';
      const toId = e.to?.element?.id ?? e.to?.name ?? '';
      const from = lookup.get(fromId);
      const to = lookup.get(toId);
      if (!from || !to) return null;
      return {
        id: e.id,
        from: anchorPoint(from, to),
        to: anchorPoint(to, from),
        label: e.description || undefined,
      } as RenderEdge;
    })
    .filter((e): e is RenderEdge => e !== null);

  return { nodes, edges };
}

function anchorPoint(from: RenderNode, to: RenderNode): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx > absDy) {
    return { x: from.x + (dx > 0 ? HALF : -HALF), y: from.y };
  }
  return { x: from.x, y: from.y + (dy > 0 ? HALF : -HALF) };
}

export function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const cp = Math.max(dx, dy) * 0.4;
  const isHorizontal = dx > dy;
  if (isHorizontal) {
    const dir = to.x > from.x ? cp : -cp;
    return `M ${from.x} ${from.y} C ${from.x + dir} ${from.y}, ${to.x - dir} ${to.y}, ${to.x} ${to.y}`;
  }
  const dir = to.y > from.y ? cp : -cp;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + dir}, ${to.x} ${to.y - dir}, ${to.x} ${to.y}`;
}

export function nodeShape(kind: NodeKind): 'circle' | 'rect' | 'diamond' {
  if (kind === 'process') return 'rect';
  if (kind === 'exclusive_gateway' || kind === 'parallel_gateway') return 'diamond';
  return 'circle';
}

export function nodeColor(kind: NodeKind): { fill: string; stroke: string } {
  switch (kind) {
    case 'start_event': return { fill: '#d4edda', stroke: '#28a745' };
    case 'end_event': return { fill: '#f8d7da', stroke: '#dc3545' };
    case 'timer_event': return { fill: '#fff3cd', stroke: '#ffc107' };
    case 'process': return { fill: '#e7f0ff', stroke: '#4a6fa5' };
    case 'exclusive_gateway': return { fill: '#fff8e1', stroke: '#f57c00' };
    case 'parallel_gateway': return { fill: '#f3e5f5', stroke: '#7b1fa2' };
  }
}

export { NODE_SIZE, HALF };
export type { Canvas };

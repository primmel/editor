import type { Standard } from '@primmel/primmel';

type Canvas = Standard['pages'][number];

export interface RenderNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label: string;
  /** The node sits in the page's data section (dashed data link). */
  isData?: boolean;
}

export interface RenderEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
  condition?: string;
  isDataLink?: boolean;
}

export type NodeKind =
  | 'start_event' | 'end_event' | 'timer_event' | 'signal_event'
  | 'process' | 'approval' | 'exclusive_gateway' | 'parallel_gateway'
  | 'dataclass' | 'subprocess';

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
    if (ev.eventType === 'timer') return 'timer_event';
    return 'signal_event';
  }
  const gw = model.gateways.find((g) => g.id === elementId);
  if (gw) {
    return gw.gatewayType === 'exclusive_gateway' ? 'exclusive_gateway' : 'parallel_gateway';
  }
  if (model.approvals.some((a) => a.id === elementId)) return 'approval';
  if (model.dataclasses.some((d) => d.id === elementId)) return 'dataclass';
  if (model.pages.some((p) => p.id === elementId)) return 'subprocess';
  return 'process';
}

function resolveLabel(model: Standard, elementId: string): string {
  const proc = model.processes.find((p) => p.id === elementId);
  if (proc) return proc.name || proc.id;
  const ap = model.approvals.find((a) => a.id === elementId);
  if (ap) return ap.name || ap.id;
  return elementId;
}

/** The canvas render model — nodes (child + data sections) and edges,
 *  with an optional viewport cull (skip nodes fully outside `viewport`
 *  plus a margin — the 500-node path stays at frame rate). */
export function renderCanvas(
  model: Standard,
  canvas: Canvas | null,
  viewport?: { x: number; y: number; w: number; h: number },
): { nodes: RenderNode[]; edges: RenderEdge[] } {
  if (!canvas || !canvas.childs) return { nodes: [], edges: [] };

  const margin = NODE_SIZE * 2;
  const inView = (x: number, y: number) =>
    !viewport
    || (x >= viewport.x - margin && x <= viewport.x + viewport.w + margin
      && y >= viewport.y - margin && y <= viewport.y + viewport.h + margin);

  const nodes: RenderNode[] = canvas.childs
    .filter((c) => inView(c.x ?? 0, c.y ?? 0))
    .map((c) => ({
      id: c.element?.id ?? c.name,
      x: c.x ?? 0,
      y: c.y ?? 0,
      kind: resolveNodeKind(model, c.element?.id ?? c.name),
      label: resolveLabel(model, c.element?.id ?? c.name),
    }));
  const dataNodes: RenderNode[] = (canvas.data ?? [])
    .filter((c) => inView(c.x ?? 0, c.y ?? 0))
    .map((c) => ({
      id: c.element?.id ?? c.name,
      x: c.x ?? 0,
      y: c.y ?? 0,
      kind: 'dataclass' as const,
      label: resolveLabel(model, c.element?.id ?? c.name),
      isData: true,
    }));

  const lookup = new Map([...nodes, ...dataNodes].map((n) => [n.id, n]));
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
        condition: e.condition || undefined,
        isDataLink: Boolean(from.isData || to.isData),
      } as RenderEdge;
    })
    .filter((e): e is RenderEdge => e !== null);

  return { nodes: [...nodes, ...dataNodes], edges };
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

export function nodeShape(kind: NodeKind): 'circle' | 'rect' | 'diamond' | 'cylinder' | 'frame' {
  if (kind === 'process') return 'rect';
  if (kind === 'approval' || kind === 'exclusive_gateway' || kind === 'parallel_gateway') return 'diamond';
  if (kind === 'dataclass') return 'cylinder';
  if (kind === 'subprocess') return 'frame';
  return 'circle';
}

export function nodeColor(kind: NodeKind): { fill: string; stroke: string } {
  switch (kind) {
    case 'start_event': return { fill: '#d4edda', stroke: '#28a745' };
    case 'end_event': return { fill: '#f8d7da', stroke: '#dc3545' };
    case 'timer_event': return { fill: '#fff3cd', stroke: '#ffc107' };
    case 'signal_event': return { fill: '#e2e3f1', stroke: '#6c63a6' };
    case 'process': return { fill: '#e7f0ff', stroke: '#4a6fa5' };
    case 'approval': return { fill: '#fdeaea', stroke: '#b85555' };
    case 'exclusive_gateway': return { fill: '#fff8e1', stroke: '#f57c00' };
    case 'parallel_gateway': return { fill: '#f3e5f5', stroke: '#7b1fa2' };
    case 'dataclass': return { fill: '#e6f4f1', stroke: '#2f7d6b' };
    case 'subprocess': return { fill: '#eef1ff', stroke: '#5b6bc0' };
  }
}

export { NODE_SIZE, HALF };
export type { Canvas };

// ─────────────────────────────────────────────────────────────────────
// The canvas auto-layout (elkjs, lazy-loaded): the layered layout
// spreads the page's elements along their flow — the authored R 60
// pages carry no coordinates worth reading (the conversion left them
// stacked at 0,0), and a layout is an EDIT: the positions apply
// through one command, undo in one step, save back into the package.
// ─────────────────────────────────────────────────────────────────────

import type { RenderNode } from './render';

export interface LayoutEdge {
  id: string;
  fromId: string;
  toId: string;
}

/** One page's layout: nodes keyed by id with their computed centers
 *  (the canvas renders nodes CENTERED on x/y; elk positions are
 *  top-left, so the centers convert on the way out). */
export async function layoutPage(
  nodes: readonly RenderNode[],
  edges: readonly LayoutEdge[],
): Promise<Map<string, { x: number; y: number }>> {
  const ELK = (await import('elkjs')).default;
  const elk = new ELK();
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.edgeNode': '24',
      // An edgeless page (the R 60 canvases carry element groups with
      // no authored edges yet) still spreads: the layered algorithm
      // falls back to packing.
      'elk.layered.unnecessaryBendpoints': 'true',
    },
    children: nodes.map(n => ({
      id: n.id,
      // The label rides beside/below the 56px shape — the box must
      // cover it or elk packs label text onto neighbors.
      width: Math.max(56, n.label.length * 7.4 + 8),
      height: 74,
    })),
    edges: edges
      .filter(e => nodes.some(n => n.id === e.fromId) && nodes.some(n => n.id === e.toId))
      .map(e => ({ id: e.id, sources: [e.fromId], targets: [e.toId] })),
  };
  const out = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of out.children ?? []) {
    positions.set(child.id, {
      x: Math.round((child.x ?? 0) + (child.width ?? 56) / 2),
      y: Math.round((child.y ?? 0) + (child.height ?? 74) / 2),
    });
  }
  return positions;
}

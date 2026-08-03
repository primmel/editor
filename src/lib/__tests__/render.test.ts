// ─────────────────────────────────────────────────────────────────────
// TODO.editor/34 — the render layer's proofs: labels, kinds, the
// viewport cull, anchors, the canvas extraction.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import {
  bezierPath, extractCanvas, nodeColor, nodeShape, renderCanvas, NODE_SIZE,
} from '../render';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }
end_event Done { }

process Named {
  name "A display name"
  actor r1
}

process Unnamed {
  actor r1
}

class DC1 {
  a: string {
    definition "a"
  }
}

exclusive_gateway X1 { }

canvas Root {
  elements {
    Start { x 0 y 0 }
    Named { x 0 y 100 }
    Unnamed { x 0 y 200 }
    X1 { x 0 y 300 }
    Done { x 0 y 400 }
  }
  process_flow {
    E1 { from Start to Named }
    E2 { from Named to Unnamed
      condition "x > 0"
    }
  }
  data {
    DC1 { x 200 y 200 }
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

describe('34 — labels and kinds', () => {
  it('the label is the name when set, else the id', () => {
    const { nodes } = renderCanvas(fresh(), extractCanvas(fresh(), null));
    expect(nodes.find(n => n.id === 'Named')!.label).toBe('A display name');
    expect(nodes.find(n => n.id === 'Unnamed')!.label).toBe('Unnamed');
  });

  it('the kinds resolve: events, processes, gateways, the data section', () => {
    const model = fresh();
    const { nodes } = renderCanvas(model, extractCanvas(model, null));
    expect(nodes.find(n => n.id === 'Start')!.kind).toBe('start_event');
    expect(nodes.find(n => n.id === 'Done')!.kind).toBe('end_event');
    expect(nodes.find(n => n.id === 'Named')!.kind).toBe('process');
    expect(nodes.find(n => n.id === 'X1')!.kind).toBe('exclusive_gateway');
    const dc = nodes.find(n => n.id === 'DC1')!;
    expect(dc.kind).toBe('dataclass');
    expect(dc.isData).toBe(true);
  });

  it('nodeShape/nodeColor cover every kind', () => {
    const kinds = [
      'start_event', 'end_event', 'timer_event', 'signal_event',
      'process', 'approval', 'exclusive_gateway', 'parallel_gateway',
      'dataclass', 'subprocess',
    ] as const;
    for (const k of kinds) {
      expect(nodeShape(k)).toBeTruthy();
      expect(nodeColor(k).stroke).toBeTruthy();
    }
    expect(nodeShape('process')).toBe('rect');
    expect(nodeShape('exclusive_gateway')).toBe('diamond');
    expect(nodeShape('dataclass')).toBe('cylinder');
    expect(nodeShape('subprocess')).toBe('frame');
  });
});

describe('34 — the edges', () => {
  it('anchors pick the dominant axis; conditions carry', () => {
    const model = fresh();
    const { edges } = renderCanvas(model, extractCanvas(model, null));
    const e2 = edges.find(e => e.id === 'E2')!;
    expect(e2.condition).toBe('x > 0');
    // Named (0,100) → Unnamed (0,200): vertical — the anchor moves in y.
    expect(e2.from.y).toBe(100 + NODE_SIZE / 2);
    expect(e2.from.x).toBe(0);
  });

  it('a data-link edge is marked dashed', () => {
    const model = fresh();
    const root = model.pages.find(p => p.id === model.root?.id)!;
    root.edges.push({
      id: 'E9',
      from: { name: 'Named', element: { id: 'Named' }, x: 0, y: 0 },
      to: { name: 'DC1', element: { id: 'DC1' }, x: 0, y: 0 },
      description: '', condition: '',
    });
    const { edges } = renderCanvas(model, extractCanvas(model, null));
    expect(edges.find(e => e.id === 'E9')!.isDataLink).toBe(true);
    expect(edges.find(e => e.id === 'E1')!.isDataLink).toBe(false);
  });

  it('bezierPath: horizontal for dominant dx, vertical for dominant dy', () => {
    expect(bezierPath({ x: 0, y: 0 }, { x: 200, y: 10 })).toContain('C 80 0');
    expect(bezierPath({ x: 0, y: 0 }, { x: 10, y: 200 })).toContain('C 0 80');
  });
});

describe('34 — the viewport cull', () => {
  it('culls nodes outside the window (with margin), keeps edges of visible pairs', () => {
    const model = fresh();
    const canvas = extractCanvas(model, null)!;
    // A window covering only Start + Named (plus the 2× margin): y from
    // −212 to +172 — Unnamed (200), X1 (300), Done (400), DC1 (200,200) out.
    const viewport = { x: -100, y: -100, w: 200, h: 160 };
    const { nodes, edges } = renderCanvas(model, canvas, viewport);
    const ids = nodes.map(n => n.id);
    expect(ids).toContain('Start');
    expect(ids).toContain('Named');
    expect(ids).not.toContain('Unnamed');
    expect(ids).not.toContain('Done');
    expect(ids).not.toContain('DC1');
    // E1 (Start→Named) is visible; E2 (Named→Unnamed) culls with Unnamed.
    expect(edges.map(e => e.id)).toEqual(['E1']);
  });

  it('no viewport renders everything', () => {
    const model = fresh();
    const { nodes } = renderCanvas(model, extractCanvas(model, null));
    expect(nodes).toHaveLength(6); // 5 flow + 1 data
  });
});

describe('34 — extractCanvas', () => {
  it('null id falls back to the root content page', () => {
    const model = fresh();
    const canvas = extractCanvas(model, null)!;
    expect(canvas.id).toBe('Root');
    expect(canvas.childs.length).toBeGreaterThan(0);
  });

  it('an unknown id returns null (no silent fallback)', () => {
    const model = fresh();
    expect(extractCanvas(model, 'Nope')).toBeNull();
  });
});

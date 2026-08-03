// ─────────────────────────────────────────────────────────────────────
// TODO.editor/34 — the auto-layout's proofs: BFS levels, sibling
// stacking, cycles cannot hang, the no-start fallback.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { autoLayout, SPACING_X, SPACING_Y } from '../layout';
import { extractCanvas } from '../render';

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

process A { actor r1 }
process B1 { actor r1 }
process B2 { actor r1 }
process C { actor r1 }

canvas Root {
  elements {
    Start { x 0 y 0 }
    A { x 0 y 0 }
    B1 { x 0 y 0 }
    B2 { x 0 y 0 }
    C { x 0 y 0 }
    Done { x 0 y 0 }
  }
  process_flow {
    E1 { from Start to A }
    E2 { from A to B1 }
    E3 { from A to B2 }
    E4 { from B1 to C }
    E5 { from B2 to C }
    E6 { from C to Done }
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

describe('34 — the auto-layout', () => {
  it('a diamond flow levels correctly and stacks siblings', () => {
    const model = fresh();
    const canvas = extractCanvas(model, null)!;
    autoLayout(canvas, model);
    const pos = Object.fromEntries(canvas.childs.map(c => [c.name, [c.x, c.y]]));
    expect(pos['Start']).toEqual([0, 0]);
    expect(pos['A']).toEqual([SPACING_X, 0]);
    expect(pos['B1']).toEqual([2 * SPACING_X, 0]);
    expect(pos['B2']).toEqual([2 * SPACING_X, SPACING_Y]);
    expect(pos['C']).toEqual([3 * SPACING_X, 0]);
    expect(pos['Done']).toEqual([4 * SPACING_X, 0]);
  });

  it('a cycle cannot hang the walk', () => {
    const model = fresh();
    const canvas = extractCanvas(model, null)!;
    canvas.edges.push({
      id: 'E7',
      from: { name: 'C', element: { id: 'C' }, x: 0, y: 0 },
      to: { name: 'A', element: { id: 'A' }, x: 0, y: 0 },
      description: '', condition: '',
    });
    // Completes (the visited set + depth cap) and keeps sane levels.
    autoLayout(canvas, model);
    const pos = Object.fromEntries(canvas.childs.map(c => [c.name, [c.x, c.y]]));
    expect(pos['Start']).toEqual([0, 0]);
    expect(pos['C']![0]).toBe(3 * SPACING_X);
  });

  it('no start event stacks everything vertically', () => {
    const model = load(`root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

process A { actor r1 }
process B { actor r1 }

canvas Root {
  elements {
    A { x 0 y 0 }
    B { x 0 y 0 }
  }
  process_flow {
    E1 { from A to B }
  }
}`);
    const canvas = extractCanvas(model, null)!;
    autoLayout(canvas, model);
    const pos = Object.fromEntries(canvas.childs.map(c => [c.name, [c.x, c.y]]));
    expect(pos['A']).toEqual([0, 0]);
    expect(pos['B']).toEqual([0, SPACING_Y]);
  });
});

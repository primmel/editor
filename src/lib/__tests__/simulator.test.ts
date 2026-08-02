// ─────────────────────────────────────────────────────────────────────
// TODO.editor/13 — the process simulation's proofs:
//   - the condition evaluator (numbers, strings, booleans, logic);
//   - the walk: start → process → gateway → the true branch, with the
//     trajectory matching the declared steps;
//   - a gate branches on an EDITED register; a gate with no true
//     branch and no default BLOCKS (the register edit unblocks it);
//   - a subprocess node descends; the end event completes; reset
//     restores the initial registers; the MODEL is never touched.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { createRun, evaluateCondition, resetRun, step } from '../simulator';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

variable load {
  type float
  definition "The applied load"
  description "kg"
}

start_event Start { }
end_event Done { }

exclusive_gateway X1 { }

process Weigh {
  name "Weigh the load"
  actor r1
}

process Heavy {
  name "Heavy path"
  actor r1
}

process Light {
  name "Light path"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Weigh { x 0 y 100 }
    X1 { x 0 y 200 }
    Heavy { x 0 y 300 }
    Light { x 100 y 300 }
    Done { x 50 y 400 }
  }
  process_flow {
    E1 { from Start to Weigh }
    E2 { from Weigh to X1 }
    E3 { from X1 to Heavy
      condition "load > 50"
    }
    E4 { from X1 to Light }
    E5 { from Heavy to Done }
    E6 { from Light to Done }
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

function walkThrough(model: Standard, registers: Record<string, string>): { path: string[]; done: boolean; trajectory: string[] } {
  let state = createRun(model, { registers });
  const path: string[] = [];
  let guard = 0;
  while (!state.done && !state.blocked && guard++ < 50) {
    state = step(model, state);
    if (state.current) path.push(state.current.nodeId);
  }
  return {
    path,
    done: state.done,
    trajectory: state.trajectory.map(t => t.nodeId),
  };
}

describe('13 — the condition evaluator', () => {
  it('numbers, strings, booleans, logic', () => {
    expect(evaluateCondition('load > 50', { load: '80' })).toBe(true);
    expect(evaluateCondition('load > 50', { load: '40' })).toBe(false);
    expect(evaluateCondition('load >= 50', { load: '50' })).toBe(true);
    expect(evaluateCondition("mode = 'auto'", { mode: 'auto' })).toBe(true);
    expect(evaluateCondition("mode != 'auto'", { mode: 'auto' })).toBe(false);
    expect(evaluateCondition('load > 50 and load < 100', { load: '80' })).toBe(true);
    expect(evaluateCondition('load < 50 or load > 100', { load: '80' })).toBe(false);
    expect(evaluateCondition('not (load > 50)', { load: '80' })).toBe(false);
    expect(evaluateCondition('(load > 50)', { load: '80' })).toBe(true);
    // Unknown identifiers read as empty — compare false against numbers.
    expect(evaluateCondition('ghost > 0', {})).toBe(false);
    expect(() => evaluateCondition('load >', { load: '1' })).toThrow();
  });
});

describe('13 — the walk', () => {
  it('the default branch fires when the condition is false', () => {
    const model = fresh();
    const run = walkThrough(model, { load: '20' });
    expect(run.path).toEqual(['Weigh', 'X1', 'Light']);
    // The end event completes inline — the trajectory closes at Done.
    expect(run.done).toBe(true);
    expect(run.trajectory).toEqual(['Start', 'Weigh', 'X1', 'Light', 'Done', 'Done']);
  });

  it('the gate branches on the edited register', () => {
    const model = fresh();
    const run = walkThrough(model, { load: '80' });
    expect(run.path).toEqual(['Weigh', 'X1', 'Heavy']);
    expect(run.done).toBe(true);
    expect(run.trajectory).toContain('Heavy');
    expect(run.trajectory).not.toContain('Light');
  });

  it('the trajectory records every stop with notes', () => {
    const model = fresh();
    let state = createRun(model, { registers: { load: '80' } });
    expect(state.trajectory[0]).toMatchObject({ seq: 1, nodeId: 'Start', kind: 'start' });
    state = step(model, state); // Weigh
    state = step(model, state); // X1
    state = step(model, state); // Heavy
    const last = state.trajectory[state.trajectory.length - 1]!;
    expect(last.nodeId).toBe('Heavy');
    expect(last.note).toContain('load > 50');
  });

  it('a gate with no true branch and no default BLOCKS; the register edit unblocks', () => {
    const model = fresh();
    // Remove the default edge E4 — the only branch is the conditioned one.
    const root = model.pages.find(p => p.id === model.root?.id)!;
    root.edges = root.edges.filter(e => e.id !== 'E4');

    let state = createRun(model, { registers: { load: '20' } });
    state = step(model, state); // Weigh
    state = step(model, state); // X1
    state = step(model, state); // blocked
    expect(state.blocked).toContain('no branch of X1 is true');
    expect(state.done).toBe(false);

    // The register edit unblocks the same gate.
    state = { ...state, registers: { ...state.registers, load: '80' }, blocked: null };
    state = step(model, state);
    expect(state.current?.nodeId).toBe('Heavy');
  });

  it('reset restores the initial registers; the MODEL is untouched', () => {
    const model = fresh();
    const before = JSON.parse(JSON.stringify(model));
    let state = createRun(model, { registers: { load: '80' } });
    state = step(model, state);
    state.registers['load'] = '999';

    const reset = resetRun(model);
    expect(reset.registers['load']).toBe('');
    expect(reset.trajectory).toHaveLength(1);
    // The honest wall: the model is byte-identical.
    expect(JSON.parse(JSON.stringify(model))).toEqual(before);
  });
});

describe('13 — subprocess descent', () => {
  it('a subprocess node descends; the end event completes at root', () => {
    const model = load(`root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }
end_event Done { }

process Outer {
  name "Outer"
  actor r1
  canvas Page1
}

process Inner {
  name "Inner"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Page1 { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to Page1 }
    E9 { from Page1 to Done }
  }
}

canvas Page1 {
  elements {
    Start { x 0 y 0 }
    Inner { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E2 { from Start to Inner }
    E3 { from Inner to Done }
  }
}`);
    const run = walkThrough(model, {});
    // The subprocess node (entering), the inner start, the inner
    // process, the node again (just returned), then the run completes
    // at root's Done (inline end handling).
    expect(run.path).toEqual(['Page1', 'Start', 'Inner', 'Page1']);
    expect(run.done).toBe(true);
    expect(run.trajectory[run.trajectory.length - 2]).toBe('Done');
  });
});

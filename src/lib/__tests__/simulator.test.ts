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
    E4 { from X1 to Light
      condition default
    }
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

  it('a conditioned edge wins from ANY node (not only gateways)', () => {
    // Weigh has E2 (default → X1) first; adding a TRUE conditioned
    // edge to Done later must still win over the earlier default.
    const model = fresh();
    const root = model.pages.find(p => p.id === model.root?.id)!;
    root.edges.push({
      id: 'E7',
      from: { name: 'Weigh', element: { id: 'Weigh' }, x: 0, y: 0 },
      to: { name: 'Done', element: { id: 'Done' }, x: 0, y: 0 },
      description: '', condition: 'load > 50',
    });
    let state = createRun(model, { registers: { load: '80' } });
    state = step(model, state); // Weigh
    state = step(model, state); // the conditioned edge wins → Done (run completes)
    expect(state.done).toBe(true);
    expect(state.trajectory.some(t => t.note.includes('load > 50'))).toBe(true);

    // …and with the condition false, the earlier default fires.
    let other = createRun(model, { registers: { load: '20' } });
    other = step(model, other); // Weigh
    other = step(model, other); // default → X1
    expect(other.current?.nodeId).toBe('X1');
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


// The corpus condition spellings (the rename contract's condition
// language): the MMEL v2 bracket-register form, the legacy '='
// equality, and the membership/aggregate spellings the library's
// gateway conditions use (r144's applicability gateways, r60-lml's
// test-result gateway) all evaluate.
describe('the condition language: the corpus spellings', () => {
  const registers = {
    sampling_approach: 'extractive',
    lab_kind: 'manufacturer_test_lab',
    scheme: 'A',
    power_supply: 'battery',
    within_mpe: 'true,true,true',
    within_mpe_bad: 'true,false,true',
    OpV: '320',
  };
  it('evaluates the bracket register form with the legacy = equality', () => {
    expect(evaluateCondition('[lab_kind] = \'manufacturer_test_lab\' and [scheme] = \'A\'', registers)).toBe(true);
    expect(evaluateCondition('[OpV] <= 320', registers)).toBe(true);
    expect(evaluateCondition('[OpV] < 320', registers)).toBe(false);
  });
  it('evaluates the membership spelling over list literals', () => {
    expect(evaluateCondition("[sampling_approach] in ['extractive']", registers)).toBe(true);
    expect(evaluateCondition("[power_supply] in ['battery', 'ac-and-battery']", registers)).toBe(true);
    expect(evaluateCondition("[sampling_approach] in ['battery', 'ac-and-battery']", registers)).toBe(false);
  });
  it('evaluates the every aggregate over register lists', () => {
    expect(evaluateCondition('every([within_mpe]) = true', registers)).toBe(true);
    expect(evaluateCondition('every([within_mpe_bad]) = true', registers)).toBe(false);
  });
  it('composes with not and parentheses', () => {
    expect(evaluateCondition("not ([sampling_approach] in ['battery'])", registers)).toBe(true);
  });
});


// The gateway `default` keyword — the corpus's spelling (r60-lml's
// test-result gateway, r144's skip edges): the edge whose condition is
// the literal `default` is the catch-all tried LAST; the underspecified
// rule (an edge with NO condition makes the gate inclusive) follows the
// legacy Checker.
describe('the gateway default-keyword semantics (the corpus spelling)', () => {
  const src = (conditions: string[]) => `
root home
metadata {
  title "T"
  schema "MMEL 0.1"
  edition "1"
  author "A"
  namespace "T"
  shortname ""
}
start_event s { }
end_event e { }
exclusive_gateway g { label "The gate" }
process p1 { name "P1" }
process p2 { name "P2" }
canvas home {
  elements {
    s { x 0 y 0 }
    p1 { x 0 y 100 }
    g { x 0 y 200 }
    p2 { x 0 y 300 }
    e { x 0 y 400 }
  }
  process_flow {
    E1 { from s to p1 }
    E2 { from p1 to g }
${conditions
  .map((c, i) => `    G${i} { from g to ${i === 0 ? 'p2' : 'e'}${c === '' ? '' : `\n      condition ${JSON.stringify(c)}`}\n    }`)
  .join('\n')}
    E9 { from p2 to e }
  }
}
`;
  it('the default edge fires when no conditioned branch is true', () => {
    const model = load(
      src(['every([within_mpe]) = true', 'default']),
    ) as unknown as Standard;
    // registers: within_mpe has a false — the conditioned branch fails,
    // the default fires.
    let st = createRun(model, { registers: { within_mpe: 'true,false' } });
    // step past start, p1, and the gateway decision
    st = step(model, st); // start
    st = step(model, st); // p1
    st = step(model, st); // gateway chooses
    expect(st.blocked).toBeNull();
    expect(st.trajectory.some(t => t.note === 'default branch')).toBe(true);
  });
  it('the conditioned branch wins over the default when true', () => {
    const model = load(
      src(['every([within_mpe]) = true', 'default']),
    ) as unknown as Standard;
    let st = createRun(model, { registers: { within_mpe: 'true,true' } });
    st = step(model, st);
    st = step(model, st);
    st = step(model, st);
    expect(st.blocked).toBeNull();
    expect(st.trajectory.some(t => t.note?.includes('is true'))).toBe(true);
  });
  it('blocked when none true and no default edge exists', () => {
    const model = load(src(['every([within_mpe]) = true', 'false'])) as unknown as Standard;
    let st = createRun(model, { registers: { within_mpe: 'false' } });
    st = step(model, st);
    st = step(model, st);
    st = step(model, st);
    expect(st.blocked).toBeTruthy();
  });
});

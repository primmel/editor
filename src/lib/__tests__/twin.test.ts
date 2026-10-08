// ─────────────────────────────────────────────────────────────────────
// G14 — the tick pipeline's proofs, over the corpus's own measurement
// semantics: the stream feeds the MEASURED quantity (the BS6004 cable
// reel changes 1.0 → 1.5), the TABLE lookups derive what the
// requirements now are, and the alert fires on the false→true edge
// only; a condition over absent operands stays quiet.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { startTwin, tick, type StreamSource } from '../twin';

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

table data {
  title "Data"
  columns "5"
  data {
    "" "Rated voltage of cable" "" "Conductor-earth" ""
    "6181Y" "1 x 1.0" "1" "1" "0.6"
    "6181Y" "1 x 1.5" "1.5" "1" "0.7"
  }
}

variable type {
  type TABLE_OPTIONS
  definition "data,0,2,area,3,class"
  description "Type of cable"
}

variable thicknessReq {
  type TABLE_REFERENCE
  definition "data,4,0,type,2,area,3,class"
  description "Thickness requirement"
}
`;

function model(): Standard {
  return load(MODEL) as unknown as Standard;
}

// The stream: the reel change at t=10 — the measured area steps
// 1 → 1.5 (the source is a step function over the corpus's own grid).
const reelChange: StreamSource[] = [
  { variable: 'area', label: 'cable reel (the measured area)', at: (t) => (t <= 10 ? 1 : 1.5) },
];

describe('the tick pipeline (G14)', () => {
  it('one tick: the reading assigns and the lookups derive', () => {
    const m = model();
    let run = startTwin({ area: '1', class: '1' });
    run = tick(m, run, reelChange, [], 2);
    expect(run.t).toBe(2);
    expect(run.seq).toBe(1);
    expect(run.registers.type).toBe('6181Y');
    expect(run.registers.thicknessReq).toBe('0.6');
    expect(run.log[0]!.values.thicknessReq).toBe(0.6);
  });

  it('the regime change flows through the lookups on a later tick', () => {
    const m = model();
    let run = startTwin({ class: '1' });
    run = tick(m, run, reelChange, [], 5);
    run = tick(m, run, reelChange, [], 5);
    // t=10: still the 1.0 build
    expect(run.registers.thicknessReq).toBe('0.6');
    // t=15: the 1.5 build — the requirement follows the measurement
    run = tick(m, run, reelChange, [], 5);
    expect(run.registers.area).toBe('1.5');
    expect(run.registers.type).toBe('6181Y');
    expect(run.registers.thicknessReq).toBe('0.7');
  });

  it('the alert fires on the false→true edge only', () => {
    const m = model();
    let run = startTwin({ class: '1' });
    const cond = [{ label: 'thick', condition: 'thicknessReq > 0.65' }];
    const steps: StreamSource[] = [
      { variable: 'area', label: 'reel', at: (t) => (t <= 2 ? 1 : 1.5) },
    ];
    run = tick(m, run, steps, cond, 2);
    expect(run.log[0]!.alerts).toEqual([]); // 0.6 — quiet
    run = tick(m, run, steps, cond, 2);
    expect(run.log[1]!.alerts).toEqual(['thick']); // 0.7 — the edge
    run = tick(m, run, steps, cond, 2);
    expect(run.log[2]!.alerts).toEqual([]); // still firing — no new edge
    expect(run.alertsOn.has('thick')).toBe(true);
  });

  it('a condition over absent operands stays quiet', () => {
    const m = model();
    let run = startTwin({});
    run = tick(m, run, [], [{ label: 'x', condition: 'nosuch > 1' }], 2);
    expect(run.log[0]!.alerts).toEqual([]);
    expect(run.alertsOn.size).toBe(0);
  });
});

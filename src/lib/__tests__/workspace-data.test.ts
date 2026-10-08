// ─────────────────────────────────────────────────────────────────────
// G13 step 2 — the instance store's proofs: the workspace file parses
// and serializes round-trip; the schema IS the paired dataclass
// (extends merges, parent first); a formless registry refuses with the
// C157 diagnostic; a malformed file is an error, never a silent empty.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import {
  emptyWorkspace, parseWorkspace, schemaOf, serializeWorkspace,
} from '../workspace-data';

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

class Sample#data {
  store { samples }
  id: string [1..1] { modality SHALL }
}

class ChainSample#data {
  extends { Sample#data }
  note: string [0..1] { modality MAY }
}

data_registry samples {
  title "Samples"
  data_class Sample#data
}

data_registry chained {
  title "Chained"
  data_class ChainSample#data
}

data_registry formless {
  title "No class"
}
`;

function model(): Standard {
  return load(MODEL) as unknown as Standard;
}

describe('the instance store (G13 step 2)', () => {
  it('round-trips the workspace file', () => {
    const doc = emptyWorkspace();
    doc.registries['samples'] = [{ id: 's1', values: { id: '6181Y-1' } }];
    const text = serializeWorkspace(doc);
    const back = parseWorkspace(text);
    expect(back.registries['samples']).toHaveLength(1);
    expect(back.registries['samples']![0]!.values.id).toBe('6181Y-1');
  });

  it('the schema is the paired dataclass', () => {
    const s = schemaOf(model(), 'samples');
    expect(s.classId).toBe('Sample#data');
    expect(s.fields.map((f) => f.id)).toEqual(['id']);
  });

  it('extends chains merge, parent first, child fields after', () => {
    const s = schemaOf(model(), 'chained');
    expect(s.classId).toBe('ChainSample#data');
    expect(s.fields.map((f) => f.id)).toEqual(['id', 'note']);
  });

  it('a formless registry refuses with the pairing diagnostic', () => {
    expect(() => schemaOf(model(), 'formless')).toThrow(/formless \(C157\)/);
  });

  it('a malformed workspace file is an error', () => {
    expect(() => parseWorkspace('{"nope": true}')).toThrow(/registries/);
  });
});

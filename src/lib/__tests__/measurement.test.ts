// ─────────────────────────────────────────────────────────────────────
// TODO.editor/16 — the measurement harness's proofs:
//   - the rows follow the process's validate_measurement facet, with
//     the declared variable joined when the point is one;
//   - the validation: missing when empty, type-mismatch warning, valid;
//   - the result formatter renders the declared shape.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { formatResult, measurementRows, validateValue } from '../measurement';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

variable temperature {
  type float
  definition "The chamber temperature"
  description "°C"
}

variable count {
  type integer
  definition "The reading count"
  description ""
}

process Weigh {
  name "Weigh"
  actor r1
  validate_measurement {
    "temperature"
    "count"
    "freeNote"
  }
}

process Plain {
  name "Plain"
  actor r1
}

canvas Root {
  elements {
    Weigh { x 0 y 0 }
    Plain { x 0 y 100 }
  }
  process_flow {
  }
}`;

function fresh(): Standard {
  return load(TEXT);
}

describe('16 — the rows', () => {
  it('one row per declared point, the variable joined', () => {
    const rows = measurementRows(fresh(), 'Weigh');
    expect(rows.map(r => r.id)).toEqual(['temperature', 'count', 'freeNote']);
    expect(rows[0]!.declared?.type).toBe('float');
    expect(rows[1]!.declared?.type).toBe('integer');
    expect(rows[2]!.declared).toBeNull();
    // A process with no facet has no rows.
    expect(measurementRows(fresh(), 'Plain')).toEqual([]);
  });
});

describe('16 — the validation', () => {
  const rows = measurementRows(fresh(), 'Weigh');
  const [temp, count, free] = rows;

  it('missing when empty', () => {
    expect(validateValue(temp!, '')).toBe('missing');
    expect(validateValue(temp!, '   ')).toBe('missing');
  });

  it('the declared type shapes the verdict', () => {
    expect(validateValue(temp!, '20.5')).toBe('valid');
    expect(validateValue(temp!, 'abc')).toBe('warning');
    expect(validateValue(count!, '42')).toBe('valid');
    expect(validateValue(count!, '42.5')).toBe('warning');
    // A free-typed point accepts anything non-empty.
    expect(validateValue(free!, 'anything at all')).toBe('valid');
  });
});

describe('16 — the result formatter', () => {
  it('renders the record per the declared shape', () => {
    const rows = measurementRows(fresh(), 'Weigh');
    const text = formatResult(rows, {
      temperature: { value: '20.5', unit: '°C', uncertainty: '0.2' },
      count: { value: '42', unit: '', uncertainty: '' },
      freeNote: { value: '', unit: '', uncertainty: '' },
    });
    expect(text).toBe(
      'temperature: 20.5 ±0.2 °C [float]\n'
      + 'count: 42 [integer]\n'
      + 'freeNote: —',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// TODO.editor/20 — the PRL language service's proofs:
//   - the completion contexts detect (actor → roles, validate_provision
//     → provisions, subprocess → pages, attribute `:` → datatypes,
//     top-level → construct keywords);
//   - the items come from the live AST;
//   - the markers map the kernel's issues and parse errors.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import {
  completionContext, completionItemsFor, markerFromParseError, markersFromIssues,
} from '../monaco-prl';

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role Factory { name "Factory" }
role QA { name "Quality" }

provision Prov1 {
  modality SHALL
  name "The provision"
}

start_event Start { }

process P1 {
  name "P one"
  actor Factory
}

class LoadCell {
  capacity: QuantityValue[1..1] {
    definition "The capacity"
  }
}

enum AccuracyClass {
  A { definition "Class A" }
}

data_registry REG1 {
  title "Register"
}

reference R60 {
  document "urn:oiml:pub:r:60-1:2021"
  clause "5.1"
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to P1 }
  }
}

canvas Page1 {
  elements {
  }
  process_flow {
  }
}`;

function ast(): Standard {
  return load(TEXT);
}

describe('20 — the completion contexts', () => {
  it('detects the slot from the line prefix', () => {
    expect(completionContext('process P1 {\n  actor ').kind).toBe('role');
    expect(completionContext('  subprocess ').kind).toBe('page');
    expect(completionContext('  canvas ').kind).toBe('page');
    expect(completionContext('  data_class ').kind).toBe('dataclass');
    expect(completionContext('  capacity: ').kind).toBe('datatype');
    expect(completionContext('  type ').kind).toBe('datatype');
    expect(completionContext('roo').kind).toBe('keyword');
  });

  it('detects the enclosing block', () => {
    expect(completionContext('process P1 {\n  validate_provision {\n    ').kind).toBe('provision');
    expect(completionContext('process P1 {\n  output {\n    ').kind).toBe('registry');
    expect(completionContext('class C {\n  a: string {\n    reference {\n      ').kind).toBe('reference');
  });
});

describe('20 — the items come from the live AST', () => {
  it('roles, provisions, pages, dataclasses, references, datatypes', () => {
    const model = ast();
    expect(completionItemsFor({ kind: 'role' }, model).map(i => i.label))
      .toEqual(['Factory', 'QA']);
    expect(completionItemsFor({ kind: 'provision' }, model).map(i => i.label))
      .toEqual(['Prov1']);
    expect(completionItemsFor({ kind: 'registry' }, model).map(i => i.label))
      .toEqual(['REG1']);
    expect(completionItemsFor({ kind: 'page' }, model).map(i => i.label))
      .toEqual(['Root', 'Page1']);
    expect(completionItemsFor({ kind: 'dataclass' }, model).map(i => i.label))
      .toEqual(['LoadCell']);
    expect(completionItemsFor({ kind: 'reference' }, model).map(i => i.label))
      .toEqual(['R60']);

    const types = completionItemsFor({ kind: 'datatype' }, model).map(i => i.label);
    expect(types).toContain('integer');
    expect(types).toContain('QuantityValue');
    expect(types).toContain('reference(LoadCell)');
    expect(types).toContain('AccuracyClass');

    const keywords = completionItemsFor({ kind: 'keyword' }, model).map(i => i.label);
    expect(keywords).toContain('process');
    expect(keywords).toContain('requirement');
  });
});

describe('20 — the markers', () => {
  it('kernel issues map to markers with position and severity', () => {
    const markers = markersFromIssues([
      { severity: 'warning', code: 'C23', construct: 'map_profile', message: 'coverage mismatch', position: { line: 12, col: 3, offset: 100 } },
      { severity: 'error', code: 'C1', construct: 'process', message: 'duplicate id' },
    ]);
    expect(markers[0]).toMatchObject({
      startLineNumber: 12, startColumn: 3, severity: 'warning',
    });
    expect(markers[0]!.message).toContain('C23');
    expect(markers[1]).toMatchObject({ startLineNumber: 1, severity: 'error' });
  });

  it('the parse error marker finds its line', () => {
    expect(markerFromParseError('Parsing error at line 42: unexpected').startLineNumber).toBe(42);
    expect(markerFromParseError('no line here').startLineNumber).toBe(1);
  });
});

describe('wave 03 G6 — the provision completion reads the real requirements', () => {
  it('a v3 package (zero provisions) completes requirement ids in validate_provision', () => {
    const model = load(`requirement /req/cs/sample-count {
  name "Sample count"
  statement "s"
  obligation shall
}
requirement /req/cs/marking {
  name "Marking"
  statement "s"
  obligation shall
}
`, { strict: true });
    const items = completionItemsFor({ kind: 'provision' }, model);
    expect(items.map(i => i.label)).toEqual(['/req/cs/sample-count', '/req/cs/marking']);
    expect(items[0]?.detail).toBe('requirement Sample count');
  });

  it('a mixed model offers the union (provisions + requirements)', () => {
    const model = load(`provision P1 {
  modality SHALL
}
requirement r1 {
  name "R"
  statement "s"
  obligation may
}
`, { strict: true });
    expect(completionItemsFor({ kind: 'provision' }, model).map(i => i.label)).toEqual(['P1', 'r1']);
  });

  it('the keyword completion carries the full v3 construct vocabulary', () => {
    const labels = completionItemsFor({ kind: 'keyword' }, load('', { strict: true })).map(i => i.label);
    for (const kw of ['monitor', 'passport', 'dataspace', 'policy', 'invariant', 'dual', 'quantity_register', 'artifact_definition', 'conformance_class', 'test_sequence']) {
      expect(labels).toContain(kw);
    }
  });
});

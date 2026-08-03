// ─────────────────────────────────────────────────────────────────────
// TODO.editor/10 — the document-mapping proofs:
//   - the presentation XML parses into clauses/paragraphs/statements
//     with stable ids and the URN discipline (OIML form + doc-local);
//   - statement splitting: a paragraph splits into sentences, each
//     individually mappable; list items are statements on their own;
//   - pairs with a URN namespace serialize and re-parse exactly.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { DOMParser } from 'linkedom';
import { dump, load, type Standard } from '@primmel/primmel';
import {
  loadDocument, parsePlainText, parsePresentationXml, splitStatements, urnBaseFor,
} from '../document-model';
import { createMappingPair } from '../commands';
import { pairsOf, profileFor } from '../mapper';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<metanorma xmlns="https://www.metanorma.org/ns/standoc" type="presentation">
<bibdata type="standard">
  <title language="en" type="main">Metrology — Load cells</title>
  <docidentifier primary="true" type="ISO">OIML R 60-2:2021</docidentifier>
</bibdata>
<sections>
  <clause id="_aaa" type="toc" displayorder="1"><title>Contents</title></clause>
  <clause id="_bbb" obligation="normative" inline-header="false">
    <title>2.10.1 Temperature effect on minimum dead load output</title>
    <p id="_p1">The temperature effect shall be measured. The measurement uses the reference temperature.</p>
    <p id="_p2">A single-sentence paragraph.</p>
    <ol>
      <li>First required condition.</li>
      <li>Second required condition.</li>
    </ol>
  </clause>
  <clause id="_ccc" obligation="normative" inline-header="false">
    <title>5.2 Test procedure</title>
    <p>Apply the load. Record the indication. Wait for stabilization.</p>
  </clause>
</sections>
</metanorma>`;

const parse = (text: string) => parsePresentationXml(text, new DOMParser());

describe('10 — the document model', () => {
  it('the URN base: the OIML form resolvable, else the doc-local slug', () => {
    expect(urnBaseFor('OIML R 60-2:2021')).toBe('urn:oiml:pub:r:60-2:2021');
    expect(urnBaseFor('OIML R 60')).toBe('urn:oiml:pub:r:60');
    expect(urnBaseFor('OIML-CS PD-05 Edition 6')).toBe('urn:oiml:pub:cs:pd-05');
  });

  it('sentence splitting respects boundaries and decimals', () => {
    expect(splitStatements('One. Two. Three.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(splitStatements('The limit is 2.5 kg. Apply it now.')).toEqual([
      'The limit is 2.5 kg.', 'Apply it now.',
    ]);
    expect(splitStatements('Single sentence')).toEqual(['Single sentence']);
    expect(splitStatements('')).toEqual([]);
  });

  it('the presentation XML parses into clauses → statements with URNs', () => {
    const doc = parse(XML);
    expect(doc.urnBase).toBe('urn:oiml:pub:r:60-2:2021');
    expect(doc.title).toContain('Load cells');
    // The ToC clause is skipped.
    expect(doc.clauses.map(c => c.number)).toEqual(['2.10.1', '5.2']);

    const c1 = doc.clauses[0]!;
    // p1 splits into two statements; p2 maps as one unit; list items
    // are statements on their own.
    expect(c1.paragraphs.map(p => p.statements.map(s => s.id))).toEqual([
      ['2.10.1.p1.s1', '2.10.1.p1.s2'],
      ['2.10.1.p2'],
      ['2.10.1.li1'],
      ['2.10.1.li2'],
    ]);
    expect(doc.statements.get('2.10.1.p1.s1')!.urn)
      .toBe('urn:oiml:pub:r:60-2:2021#2.10.1.p1.s1');
    expect(doc.statements.get('2.10.1.p1.s1')!.text)
      .toBe('The temperature effect shall be measured.');
    // The second clause splits three sentences.
    expect(doc.clauses[1]!.paragraphs[0]!.statements).toHaveLength(3);
  });

  it('the plain-text path parses lines → paragraphs → statements', () => {
    const doc = parsePlainText('First line here. Second sentence.\n\nAnother paragraph.');
    expect(doc.urnBase).toBe('doc:pasted-document');
    expect(doc.clauses[0]!.paragraphs.map(p => p.statements.map(s => s.id))).toEqual([
      ['doc.p1.s1', 'doc.p1.s2'],
      ['doc.p2'],
    ]);
  });

  it('loadDocument dispatches on the angle bracket', () => {
    expect(loadDocument(XML, undefined, new DOMParser()).urnBase).toBe('urn:oiml:pub:r:60-2:2021');
    expect(loadDocument('plain text here').urnBase).toBe('doc:pasted-document');
  });
});

describe('10 — the doc-map profile', () => {
  const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

process Measure {
  name "Measure"
  actor r1
}

canvas Root {
  elements {
    Measure { x 0 y 0 }
  }
  process_flow {
  }
}`;

  it('pairs with a URN namespace serialize and re-parse exactly', () => {
    const ast: Standard = load(IMP);
    const doc = parse(XML);
    const ns = doc.urnBase;
    // Five statements mapped with meta (the acceptance shape).
    const targets = [
      '2.10.1.p1.s1', '2.10.1.p1.s2', '2.10.1.p2', '2.10.1.li1', '5.2.p1.s1',
    ];
    for (const id of targets) {
      const urn = doc.statements.get(id)!.urn;
      createMappingPair(ns, 'Measure', urn, {
        description: `covers ${id}`,
        justification: 'trace',
      }).apply(ast);
    }

    const text = dump(ast);
    expect(text).toContain(`map_profile ${ns} {`);
    expect(text).toContain('Measure -> urn:oiml:pub:r:60-2:2021#2.10.1.p1.s1 { description "covers 2.10.1.p1.s1" justification "trace" }');

    // The round trip: all five pairs survive, URNs intact.
    const reparsed = load(text);
    const profile = profileFor(reparsed, ns)!;
    expect(pairsOf(profile, 'Measure')).toHaveLength(5);
    expect(pairsOf(profile, 'Measure').map(p => p.target)).toEqual(
      targets.map(id => `urn:oiml:pub:r:60-2:2021#${id}`),
    );
  });
});

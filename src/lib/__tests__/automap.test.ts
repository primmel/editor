// ─────────────────────────────────────────────────────────────────────
// TODO.editor/11 — the automap proofs:
//   - the suggestions pin the right matches (name + structure), with
//     reasons and a descending ranking;
//   - confirm lands the pair with the provenance justification; the
//     exact pair is never re-suggested;
//   - rejected pairs never reappear;
//   - the closure proposal (all children covered ⇒ parent) is the
//     KERNEL's own, flagged never-asserted.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { automapJustification, nameSimilarity, structuralSimilarity, suggestMappings } from '../automap';
import { coverageView } from '../coverage';
import { createMappingPair } from '../commands';
import { pairsOf, profileFor } from '../mapper';

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

data_registry REG1 {
  title "Product register"
}

process ManufactureProduct {
  name "Manufacture product"
  actor r1
  output {
    REG1
  }
}

process InspectQuality {
  name "Inspect quality"
  actor r1
  reference_data_registry {
    REG1
  }
}

process ShipGoods {
  name "Ship goods"
  actor r1
}

canvas Root {
  elements {
    ManufactureProduct { x 0 y 0 }
    InspectQuality { x 0 y 100 }
    ShipGoods { x 0 y 200 }
  }
  process_flow {
  }
}`;

const REF = `root Root

version "v1.0.0-dev1"

metadata {
  title "REF"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

data_registry REG1 {
  title "Product register"
}

process MakeProduct {
  name "Make product"
  actor q1
  output {
    REG1
  }
}

process QualityInspection {
  name "Quality inspection"
  actor q1
  reference_data_registry {
    REG1
  }
}

process DeliverGoods {
  name "Deliver goods"
  actor q1
}

process PackageGoods {
  name "Package goods"
  actor q1
}

canvas Root {
  elements {
    MakeProduct { x 0 y 0 }
    QualityInspection { x 0 y 100 }
    DeliverGoods { x 0 y 200 }
    PackageGoods { x 0 y 300 }
  }
  process_flow {
  }
}`;

function fixture(): { imp: Standard; ref: Standard } {
  return { imp: load(IMP), ref: load(REF) };
}

describe('11 — the scorer', () => {
  it('name similarity: exact, token overlap, distant', () => {
    expect(nameSimilarity({ id: 'InspectQuality' }, { id: 'InspectQuality' })).toBe(1);
    const good = nameSimilarity(
      { id: 'ManufactureProduct', name: 'Manufacture product' },
      { id: 'MakeProduct', name: 'Make product' },
    );
    expect(good).toBeGreaterThan(0.5);
    const bad = nameSimilarity({ id: 'ShipGoods' }, { id: 'QualityInspection' });
    expect(bad).toBeLessThan(good);
  });

  it('structural similarity: registry overlap', () => {
    const { imp, ref } = fixture();
    expect(structuralSimilarity(imp, ref, 'ManufactureProduct', 'MakeProduct')).toBe(1);
    expect(structuralSimilarity(imp, ref, 'ShipGoods', 'DeliverGoods')).toBe(0);
  });

  it('the top suggestions pin the right matches, ranked with reasons', () => {
    const { imp, ref } = fixture();
    const suggestions = suggestMappings(imp, ref, 'QMS');
    const top = suggestions.slice(0, 5).map(s => `${s.impId}⇒${s.refId}`);
    expect(top).toContain('ManufactureProduct⇒MakeProduct');
    expect(top).toContain('InspectQuality⇒QualityInspection');
    expect(top).toContain('ShipGoods⇒DeliverGoods');
    // Ranked descending, reasons shown.
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1]!.score).toBeGreaterThanOrEqual(suggestions[i]!.score);
    }
    const best = suggestions.find(s => s.impId === 'ManufactureProduct' && s.refId === 'MakeProduct')!;
    expect(best.reasons.some(r => r.startsWith('name '))).toBe(true);
    expect(best.reasons.some(r => r.startsWith('structure '))).toBe(true);
  });
});

describe('11 — confirm / reject / never-clobber', () => {
  it('confirm lands the pair with the provenance justification', () => {
    const { imp, ref } = fixture();
    const s = suggestMappings(imp, ref, 'QMS')
      .find(x => x.impId === 'ManufactureProduct' && x.refId === 'MakeProduct')!;
    createMappingPair('QMS', s.impId, 'QMS#' + s.refId, {
      description: s.reasons.join('; '),
      justification: automapJustification(s),
    }).apply(imp);

    const pair = pairsOf(profileFor(imp, 'QMS'), 'ManufactureProduct')[0]!;
    expect(pair.target).toBe('QMS#MakeProduct');
    expect(pair.justification).toContain('auto-suggested');
    expect(pair.justification).toContain('confirmed by operator');
    expect(pair.description).toContain('name ');

    // The exact pair is never re-suggested.
    const after = suggestMappings(imp, ref, 'QMS');
    expect(after.some(x => x.impId === 'ManufactureProduct' && x.refId === 'MakeProduct')).toBe(false);
    // …and other candidates still rank (the confirm never clobbers).
    expect(after.some(x => x.impId === 'InspectQuality' && x.refId === 'QualityInspection')).toBe(true);
  });

  it('rejected pairs never reappear', () => {
    const { imp, ref } = fixture();
    const skip = new Set(['ShipGoods|DeliverGoods']);
    const suggestions = suggestMappings(imp, ref, 'QMS', { skip });
    expect(suggestions.some(x => x.impId === 'ShipGoods' && x.refId === 'DeliverGoods')).toBe(false);
    expect(suggestions.some(x => x.impId === 'ShipGoods')).toBe(true); // other targets remain
  });
});

describe('11 — the closure proposal', () => {
  it('a parent with all children covered is proposed, never asserted', () => {
    const imp = load(`root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

process StepA {
  name "A"
  actor r1
}

process StepB {
  name "B"
  actor r1
}

canvas Root {
  elements {
    StepA { x 0 y 0 }
    StepB { x 0 y 100 }
  }
  process_flow {
  }
}`);
    const ref = load(`root Root

version "v1.0.0-dev1"

metadata {
  title "REF"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

process Whole {
  name "Whole"
  actor q1

  process PartA {
    name "Part A"
    actor q1
  }

  process PartB {
    name "Part B"
    actor q1
  }
}

canvas Root {
  elements {
    Whole { x 0 y 0 }
  }
  process_flow {
  }
}`);
    createMappingPair('QMS', 'StepA', 'QMS#PartA', {}).apply(imp);
    createMappingPair('QMS', 'StepB', 'QMS#PartB', {}).apply(imp);

    const report = coverageView(imp, ref, 'QMS').report;
    const closure = report.proposals.filter(p => p.kind === 'closure');
    expect(closure.length).toBeGreaterThan(0);
    expect(closure[0]!.target).toBe('QMS#Whole');
    expect(closure[0]!.asserted).toBe(false);
    expect(closure[0]!.rationale).toContain('closure candidate');
  });
});

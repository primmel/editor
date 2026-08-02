// ─────────────────────────────────────────────────────────────────────
// TODO.editor/09 — the multi-reference proofs:
//   - profiles stay independent per reference namespace; the badges
//     list every namespace an IMP element maps into;
//   - the seed carries only the pairs whose target resolves in the
//     target reference — the rest is the review list — and the whole
//     seed reverts as one undo unit.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { load, type Standard } from '@primmel/primmel';
import { createMappingPair } from '../commands';
import { badgeMap, namespacesOf, seedProfileFrom } from '../multi-map';
import { pairsOf, profileFor } from '../mapper';

const IMP = `root Root

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "AcmeOps"
}

role r1 { name "Operator" }

process Produce {
  name "Produce"
  actor r1
}

process Inspect {
  name "Inspect"
  actor r1
}

canvas Root {
  elements {
    Produce { x 0 y 0 }
    Inspect { x 0 y 100 }
  }
  process_flow {
  }
}`;

const REF_A = `root Root

version "v1.0.0-dev1"

metadata {
  title "Quality"
  schema "Primmel 0.1"
  namespace "ISO9001"
}

role q1 { name "Auditor" }

process MakeGood {
  name "Make good"
  actor q1
}

process CheckGood {
  name "Check good"
  actor q1
}

canvas Root {
  elements {
    MakeGood { x 0 y 0 }
    CheckGood { x 0 y 100 }
  }
  process_flow {
  }
}`;

/** The second reference shares CheckGood (same id) but not MakeGood. */
const REF_B = `root Root

version "v1.0.0-dev1"

metadata {
  title "Security"
  schema "Primmel 0.1"
  namespace "ISO27001"
}

role s1 { name "ISMS Auditor" }

process CheckGood {
  name "Check good"
  actor s1
}

process GuardSecrets {
  name "Guard secrets"
  actor s1
}

canvas Root {
  elements {
    CheckGood { x 0 y 0 }
    GuardSecrets { x 0 y 100 }
  }
  process_flow {
  }
}`;

function fixture(): { imp: Standard; refA: Standard; refB: Standard } {
  const imp = load(IMP);
  createMappingPair('ISO9001', 'Produce', 'ISO9001#MakeGood', { description: 'produce makes good' }).apply(imp);
  createMappingPair('ISO9001', 'Inspect', 'ISO9001#CheckGood', {}).apply(imp);
  createMappingPair('ISO27001', 'Inspect', 'ISO27001#GuardSecrets', {}).apply(imp);
  return { imp, refA: load(REF_A), refB: load(REF_B) };
}

describe('09 — the profiles stay independent', () => {
  it('pairs land per namespace; the badges list every one', () => {
    const { imp } = fixture();
    expect(pairsOf(profileFor(imp, 'ISO9001'), 'Produce').map(p => p.target))
      .toEqual(['ISO9001#MakeGood']);
    expect(pairsOf(profileFor(imp, 'ISO9001'), 'Inspect').map(p => p.target))
      .toEqual(['ISO9001#CheckGood']);
    expect(pairsOf(profileFor(imp, 'ISO27001'), 'Inspect').map(p => p.target))
      .toEqual(['ISO27001#GuardSecrets']);
    // The cross-profile badges.
    expect(namespacesOf(imp, 'Inspect')).toEqual(['ISO27001', 'ISO9001']);
    expect(namespacesOf(imp, 'Produce')).toEqual(['ISO9001']);
    const badges = badgeMap(imp);
    expect(badges.get('Inspect')).toEqual(['ISO27001', 'ISO9001']);
    expect(badges.has('Start')).toBe(false);
  });
});

describe('09 — the seed', () => {
  it('carries resolving pairs, reviews the rest, one undo unit', () => {
    const { imp, refB } = fixture();
    // Seed a fresh namespace from the 9001 profile: CheckGood exists in
    // both references (carries), MakeGood does not (the review list).
    const { command, outcome } = seedProfileFrom('ISO9001', 'Wave2', refB);
    command.apply(imp);

    expect(outcome.carried).toBe(1);
    expect(outcome.review).toEqual(['Produce ⇒ ISO9001#MakeGood']);

    const seeded = profileFor(imp, 'Wave2')!;
    expect(seeded.description).toContain('seeded from ISO9001');
    expect(pairsOf(seeded, 'Inspect')[0]!.target).toBe('Wave2#CheckGood');
    // The source profile is untouched.
    expect(pairsOf(profileFor(imp, 'ISO9001'), 'Produce')).toHaveLength(1);

    // The whole seed is one undo unit.
    command.revert(imp);
    expect(profileFor(imp, 'Wave2')).toBeNull();
    expect(profileFor(imp, 'ISO9001')).not.toBeNull();
  });

  it('refuses to seed over an existing profile', () => {
    const { imp, refB } = fixture();
    const { command } = seedProfileFrom('ISO9001', 'ISO27001', refB);
    expect(() => command.apply(imp)).toThrow('already has a profile');
  });

  it('a clean seed carries pairs with meta and retargets the namespace', () => {
    const { imp, refB } = fixture();
    // Remove the existing 27001 profile, then seed it fresh from 9001.
    imp.mapProfiles = imp.mapProfiles.filter(p => p.namespace !== 'ISO27001');
    const { command, outcome } = seedProfileFrom('ISO9001', 'ISO27001', refB);
    command.apply(imp);

    const seeded = profileFor(imp, 'ISO27001')!;
    expect(pairsOf(seeded, 'Inspect')).toHaveLength(1);
    expect(pairsOf(seeded, 'Inspect')[0]!.target).toBe('ISO27001#CheckGood');
    expect(outcome.review).toEqual(['Produce ⇒ ISO9001#MakeGood']);

    // The whole seed is one undo unit.
    command.revert(imp);
    expect(profileFor(imp, 'ISO27001')).toBeNull();
  });
});

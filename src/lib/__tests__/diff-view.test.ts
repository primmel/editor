// ─────────────────────────────────────────────────────────────────────
// TODO.editor/12 — the model-diff view's proofs:
//   - the bridge's rows are the kernel's diffStandards entries (added /
//     removed / changed / moved), each with the facet-level
//     before/after from the elementIndex;
//   - the mapping diff rows (added / removed / changed pairs) come
//     through untouched.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { diffStandards, load, type Standard } from '@primmel/primmel';
import { diffView } from '../diff-view';

const A = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }

process P1 {
  name "P one"
  actor r1
  modality SHALL
}

process P2 {
  name "P two"
  actor r1
}

process P3 {
  name "P three"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
    P2 { x 0 y 200 }
    P3 { x 0 y 300 }
  }
  process_flow {
    E1 { from Start to P1 }
    E2 { from P1 to P2 }
    E3 { from P2 to P3 }
  }
}`;

/** B: P1 renamed (changed), P2 dropped (removed), P4 new (added),
 *  plus a map profile (the mapping diff's baseline). */
const B = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

start_event Start { }

process P1 {
  name "P one renamed"
  actor r1
  modality SHALL
}

process P3 {
  name "P three"
  actor r1
}

process P4 {
  name "P four"
  actor r1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    P1 { x 0 y 100 }
    P3 { x 0 y 300 }
    P4 { x 0 y 400 }
  }
  process_flow {
    E1 { from Start to P1 }
    E3 { from P1 to P3 }
  }
}

map_profile QMS {
  mapping {
    P1 -> QMS#MakeGood { description "kept" }
    P3 -> QMS#CheckGood { description "kept" }
    P4 -> QMS#NewPair { description "added pair" }
  }
}`;

/** A's own profile: P1 mapped (kept), P2 mapped (dropped with P2). */
const A_WITH_MAP = `${A}

map_profile QMS {
  mapping {
    P1 -> QMS#MakeGood { description "kept" }
    P2 -> QMS#RemovedPair { description "gone with P2" }
  }
}`;

describe('12 — the bridge is the kernel', () => {
  it('every change appears with its facet-level before/after', () => {
    const a: Standard = load(A);
    const b: Standard = load(B);
    const view = diffView(a, b, { aLabel: 'A', bLabel: 'B' });
    const kernel = diffStandards(a, b);

    // The same verdicts as the kernel.
    expect(view.diff.added.map(e => e.id)).toEqual(kernel.added.map(e => e.id));
    expect(view.diff.removed.map(e => e.id)).toEqual(kernel.removed.map(e => e.id));
    expect(view.diff.changed.map(e => e.id)).toEqual(kernel.changed.map(e => e.id));

    // P4 added with its facets visible.
    const added = view.byStatus.added.find(r => r.id === 'P4')!;
    expect(added.facets.length).toBeGreaterThan(0);
    expect(added.facets.every(f => f.before === null)).toBe(true);

    // P2 removed (its facets read from the OLD side).
    const removed = view.byStatus.removed.find(r => r.id === 'P2')!;
    expect(removed.facets.every(f => f.after === null)).toBe(true);

    // P1 changed: the statement facet shows the rename, before → after.
    const changed = view.byStatus.changed.find(r => r.id === 'P1')!;
    const statement = changed.facets.find(f => f.aspect === 'statement')
      ?? changed.facets.find(f => f.aspect.includes('name'));
    expect(statement).toBeDefined();
    expect(statement!.before).toContain('P one');
    expect(statement!.after).toContain('renamed');

    // The status index drives the canvas tint.
    expect(view.statusOf.get('processes:P4')).toBe('added');
    expect(view.statusOf.get('processes:P1')).toBe('changed');
  });

  it('the mapping diff: added / removed / same pairs', () => {
    const a: Standard = load(A_WITH_MAP);
    const b: Standard = load(B);
    const view = diffView(a, b, { aLabel: 'A', bLabel: 'B' });

    expect(view.mappings.added.map(m => `${m.source}⇒${m.target}`))
      .toEqual(['P3⇒QMS#CheckGood', 'P4⇒QMS#NewPair']);
    expect(view.mappings.removed.map(m => `${m.source}⇒${m.target}`))
      .toEqual(['P2⇒QMS#RemovedPair']);
    // The kept pair shows no change.
    expect(view.mappings.changed.map(m => `${m.source}⇒${m.target}`))
      .not.toContain('P1⇒QMS#MakeGood');
  });

  it('identical models diff empty', () => {
    const a: Standard = load(A);
    const view = diffView(a, load(A));
    expect(view.diff.empty).toBe(true);
    expect(view.rows).toHaveLength(0);
  });
});

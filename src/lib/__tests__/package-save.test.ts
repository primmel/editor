// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 1 — the package-aware save's proofs:
//   - an untouched package plans no writes;
//   - an edit writes ONLY its source file (the other files keep their
//     authored bytes — comments, banners, ordering);
//   - the recombination is byte-clean: the written files + the
//     untouched files reload to the working model exactly;
//   - a construct authored in-session routes to its kind's home file;
//   - edits to an IMPORTED package's constructs are surfaced, never
//     written;
//   - a manifest change writes package.primmel via the kernel's
//     dumpPackage;
//   - the collection-field list covers everything the provenance load
//     can attribute (the plan never silently drops a construct).
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump, load, loadPackageWithProvenance, type Standard } from '@primmel/primmel';
import { openPackagePayload } from '../../../scripts/package-open';
import { CONSTRUCT_FIELDS, constructId, planPackageSave } from '../package-save';
import type { PackageOpenResult } from '../package';
import { createElement, deleteInList, updateElement } from '../commands';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

function openFixture(): { session: PackageOpenResult; baseline: Standard } {
  const session = openPackagePayload(path.join(FIXTURES, 'pkg-app'));
  return { session, baseline: freshWorking(session) };
}

/** The working copy: the merged dump parsed + the manifest re-attached
 *  (the dump does not carry it) — exactly what the store holds after
 *  openPackage. The manifest is CLONED: two test ASTs must not share
 *  the object, or an edit to one masquerades as no-change in the other. */
function freshWorking(session: PackageOpenResult): Standard {
  const m = load(session.dump, { strict: true });
  m.packageManifest = structuredClone(session.manifest);
  return m;
}

/** Clone the fixture tree into a temp dir (the write leg never touches
 *  the committed fixture), returning the pkg-app copy's path. */
function cloneFixtures(): { root: string; dir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-pkg-'));
  for (const pkg of ['pkg-lib', 'pkg-app']) {
    fs.cpSync(path.join(FIXTURES, pkg), path.join(root, pkg), { recursive: true });
  }
  return { root, dir: path.join(root, 'pkg-app') };
}

describe('wave 1 — the package-open payload', () => {
  it('carries the identity, the file inventory, and the import footprint', () => {
    const { session } = openFixture();
    expect(session.id).toBe('pkg-app');
    expect(session.composition.order).toEqual(['pkg-lib', 'pkg-app']);
    expect(session.files.map((f) => f.path)).toEqual([
      'package.primmel', 'entities/widget.prl', 'model/processes.prl', 'requirements.prl',
    ]);
    expect(session.files.find((f) => f.path === 'model/processes.prl')?.constructs).toBe(1);
    expect(session.imports).toEqual([
      { package: 'pkg-lib', files: [{ path: 'terminology.prl', constructs: 2 }] },
    ]);
    // The merged dump round-trips through the strict parse (the client
    // loads exactly this text).
    const m = freshWorking(session);
    expect(m.processes).toHaveLength(1);
    expect(m.terms).toHaveLength(2);
    expect(m.packageManifest?.id).toBe('pkg-app');
  });
});

describe('wave 1 — the package save plan', () => {
  it('an untouched package plans no writes', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    const plan = planPackageSave(baseline, working, session);
    expect(plan.empty).toBe(true);
    expect(plan.writes).toHaveLength(0);
    expect(plan.foreignTouched).toHaveLength(0);
  });

  it('an edit writes only its source file', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble widgets v2' }).apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['model/processes.prl']);
    expect(plan.writes[0]!.changed).toEqual(['assemble']);
    const fileModel = load(plan.writes[0]!.text, { strict: true });
    expect(fileModel.processes[0]!.name).toBe('Assemble widgets v2');
    expect(fileModel.requirements).toHaveLength(0); // another file's construct stays out
  });

  it('the recombination is byte-clean: written + untouched files reload to the working model', () => {
    const { root, dir } = cloneFixtures();
    try {
      const session = openPackagePayload(dir);
      const baseline = freshWorking(session);
      const working = freshWorking(session);
      updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble v3' }).apply(working);
      createElement('dataclass', 'Gadget').apply(working);
      deleteInList((a: Standard) => a.enums, 'WidgetKind').apply(working);

      const plan = planPackageSave(baseline, working, session);
      expect(plan.writes.map((w) => w.path).sort()).toEqual(['entities/widget.prl', 'model/processes.prl']);

      // Apply the plan to the temp copy and reload the whole package.
      for (const w of plan.writes) fs.writeFileSync(path.join(dir, w.path), w.text);
      const reloaded = loadPackageWithProvenance(dir, {
        resolvePackage: (id) => {
          const p = path.join(root, id);
          return fs.existsSync(path.join(p, 'package.primmel')) ? p : undefined;
        },
      });
      expect(dump(reloaded.standard)).toBe(dump(working));

      // The untouched files keep their authored bytes — comments and all.
      expect(fs.readFileSync(path.join(dir, 'requirements.prl'), 'utf8'))
        .toBe(fs.readFileSync(path.join(FIXTURES, 'pkg-app/requirements.prl'), 'utf8'));
      expect(fs.readFileSync(path.join(root, 'pkg-lib/terminology.prl'), 'utf8'))
        .toContain('a comment the save must never strip');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a construct authored in-session routes to its kind’s home file', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    createElement('dataclass', 'Gadget').apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['entities/widget.prl']);
    expect(plan.writes[0]!.added).toEqual(['Gadget']);
    const fileModel = load(plan.writes[0]!.text, { strict: true });
    expect(fileModel.dataclasses.map((d) => d.id).sort()).toEqual(['Gadget', 'Widget#data']);
    expect(fileModel.enums).toHaveLength(1); // the file's other constructs stay
  });

  it('edits to an imported package’s constructs are surfaced, never written', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    updateElement((a: Standard) => a.terms, 'widget', { label: 'widget v2' }).apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes).toHaveLength(0);
    expect(plan.foreignTouched).toEqual([
      { package: 'pkg-lib', kind: 'terms', id: 'widget', status: 'changed' },
    ]);
  });

  it('a manifest change writes package.primmel via the kernel’s dumpPackage', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    working.packageManifest!.title = 'Probe App v2';

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['package.primmel']);
    expect(plan.writes[0]!.text).toContain('title "Probe App v2"');
    expect(plan.writes[0]!.text).toContain('id pkg-app');
  });

  it('a removal writes its file with the construct gone and the rest intact', () => {
    const { session, baseline } = openFixture();
    const working = freshWorking(session);
    deleteInList((a: Standard) => a.enums, 'WidgetKind').apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['entities/widget.prl']);
    expect(plan.writes[0]!.removed).toEqual(['WidgetKind']);
    const fileModel = load(plan.writes[0]!.text, { strict: true });
    expect(fileModel.enums).toHaveLength(0);
    expect(fileModel.dataclasses.map((d) => d.id)).toEqual(['Widget#data']);
  });
});

describe('wave 1 — the collection-field census', () => {
  it('every provenance field and every construct has a home in CONSTRUCT_FIELDS', () => {
    const { session, baseline } = openFixture();
    const known = new Set<string>(CONSTRUCT_FIELDS);
    for (const field of Object.keys(session.provenance.constructs)) {
      expect(known.has(field), `provenance field ${field}`).toBe(true);
    }
    for (const f of CONSTRUCT_FIELDS) {
      for (const el of baseline[f]) {
        expect(constructId(el), `${f} element`).toBeDefined();
      }
    }
  });
});

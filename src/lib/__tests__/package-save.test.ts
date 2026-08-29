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
//
// TODO.editor wave 2 — the comment-true save's proofs (the heavily
// commented pkg-commented fixture):
//   - a changed construct splices its span ONLY: the bytes before and
//     after the span are the authored bytes verbatim (the splice
//     equation), every comment line survives;
//   - a removal drops the span and collapses the doubled blank line,
//     banners untouched;
//   - an addition appends canonically AFTER the authored bytes;
//   - the metadata block splices by its span like any construct;
//   - applyPlanToSession re-bases the provenance (a second save splices
//     the NEW bytes, never stale offsets — including constructs the
//     first save appended);
//   - a file whose every construct was removed still writes (its
//     banner survives);
//   - the recombination stays byte-clean.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dump, load, loadPackageWithProvenance, type Standard } from '@primmel/primmel';
import { openPackagePayload } from '../../../scripts/package-open';
import { applyPlanToSession, CONSTRUCT_FIELDS, constructId, planPackageSave } from '../package-save';
import type { PackageOpenResult } from '../package';
import { createElement, deleteInList, updateElement, addAttribute } from '../commands';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');

function openFixture(): { session: PackageOpenResult; baseline: Standard } {
  const session = openPackagePayload(path.join(FIXTURES, 'pkg-app'));
  return { session, baseline: freshWorking(session) };
}

/** The commented fixture: banners between every construct, a metadata
 *  block mid-file, enums BEFORE classes (non-canonical order), authored
 *  double blank lines, a trailing comment. */
function openCommented(): { session: PackageOpenResult; baseline: Standard } {
  const session = openPackagePayload(path.join(FIXTURES, 'pkg-commented'));
  return { session, baseline: freshWorking(session) };
}

/** The authored bytes of one root file from the session payload. */
function authoredText(session: PackageOpenResult, relPath: string): string {
  const f = session.files.find((x) => x.path === relPath);
  if (!f) throw new Error(`no such file in the session: ${relPath}`);
  return f.text;
}

/** The span the provenance load attested for one construct. */
function spanOf(session: PackageOpenResult, field: string, id: string) {
  const src = session.provenance.constructs[field]?.[id];
  if (!src) throw new Error(`no provenance for ${field} ${id}`);
  return src.span;
}

/** Every comment line of a text (the load-bearing banners). */
function commentLines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim().startsWith('//'));
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


describe('wave 2 — the comment-true save (pkg-commented)', () => {
  it('an edit rewrites ONLY the construct’s span: the splice equation holds byte-exact', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble gadgets v2' }).apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['model/main.prl']);
    expect(plan.writes[0]!.changed).toEqual(['assemble']);

    // The byte-diff assertion (the wave's bar): the written text is the
    // authored text with exactly the construct's span replaced — every
    // byte before and after the span is verbatim, banners included.
    const authored = authoredText(session, 'model/main.prl');
    const span = spanOf(session, 'processes', 'assemble');
    const written = plan.writes[0]!.text;
    expect(written).toBe(
      authored.slice(0, span.start.offset)
        + 'process assemble {\n  name "Assemble gadgets v2"\n}'
        + authored.slice(span.end.offset),
    );
    // Every comment line of the authored file survives verbatim.
    for (const line of commentLines(authored)) expect(written).toContain(line);
    // The written file parses strict and carries the edit.
    const fileModel = load(written, { strict: true });
    expect(fileModel.processes[0]!.name).toBe('Assemble gadgets v2');
    expect(fileModel.enums).toHaveLength(1); // the untouched enum stays
  });

  it('a removal drops the span and collapses the doubled blank line; banners untouched', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    deleteInList((a: Standard) => a.enums, 'GadgetKind').apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['model/main.prl']);
    expect(plan.writes[0]!.removed).toEqual(['GadgetKind']);

    const authored = authoredText(session, 'model/main.prl');
    const span = spanOf(session, 'enums', 'GadgetKind');
    const written = plan.writes[0]!.text;
    // The span drops out with its own line ending; nothing else moves.
    // The banner directly above the enum is authored text, not span —
    // it stays, and the deliberate double blank line survives double.
    expect(written).toBe(
      authored.slice(0, span.start.offset) + authored.slice(span.end.offset + 1),
    );
    expect(written).not.toContain('enum GadgetKind');
    expect(written).toContain('// §3.2 — the gadget kinds.');
    expect(written).toContain('// §4.1 — the gadget itself.');
    const fileModel = load(written, { strict: true });
    expect(fileModel.enums).toHaveLength(0);
    expect(fileModel.dataclasses.map((d) => d.id)).toEqual(['Gadget#data']);
  });

  it('an addition appends in canonical form AFTER the authored bytes (trailing comment kept)', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    createElement('dataclass', 'Sprocket').apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['model/main.prl']);
    expect(plan.writes[0]!.added).toEqual(['Sprocket']);

    const authored = authoredText(session, 'model/main.prl');
    const written = plan.writes[0]!.text;
    // Nothing authored moves; the new construct follows one blank line
    // after the file's trailing comment.
    expect(written.startsWith(authored)).toBe(true);
    expect(written.slice(authored.length)).toBe('\nclass Sprocket {\n}\n');
    const fileModel = load(written, { strict: true });
    expect(fileModel.dataclasses.map((d) => d.id).sort()).toEqual(['Gadget#data', 'Sprocket']);
  });

  it('the metadata block splices by its span like any construct', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    working.meta.title = 'Commented Probe v2';

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['model/main.prl']);

    const authored = authoredText(session, 'model/main.prl');
    const span = spanOf(session, 'metadata', '');
    const written = plan.writes[0]!.text;
    // The canonical metadata block replaces the span; the rest is verbatim.
    expect(written.slice(0, span.start.offset)).toBe(authored.slice(0, span.start.offset));
    expect(written.endsWith(authored.slice(span.end.offset))).toBe(true);
    expect(written).toContain('title "Commented Probe v2"');
    const fileModel = load(written, { strict: true });
    expect(fileModel.meta.title).toBe('Commented Probe v2');
    expect(fileModel.meta.namespace).toBe('Commented');
  });

  it('a file whose EVERY construct is removed still writes — its banner survives', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    deleteInList((a: Standard) => a.requirements, '/req/com/mass').apply(working);

    const plan = planPackageSave(baseline, working, session);
    expect(plan.writes.map((w) => w.path)).toEqual(['requirements.prl']);
    expect(plan.writes[0]!.removed).toEqual(['/req/com/mass']);
    // Only the two comment lines remain.
    expect(plan.writes[0]!.text).toBe(
      '// The commented probe\'s requirements — a second content file, so the\n'
        + '// tests can prove an edit elsewhere leaves this file\'s bytes untouched.\n',
    );
    expect(load(plan.writes[0]!.text, { strict: true }).requirements).toHaveLength(0);
  });

  it('a blank-sandwiched removal collapses to the package’s single-blank rhythm', () => {
    // The collapse fires only when the removed construct sat BETWEEN
    // blank lines (no attached banner): one blank survives, never two.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-blank-'));
    try {
      const dir = path.join(root, 'pkg-blank');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.primmel'),
        'package {\n  id pkg-blank\n  kind rec\n  title "Blank"\n  version "1.0.0"\n  editions { "1.0.0" }\n  baseUrn "urn:example:pkg-blank:1.0.0"\n}\n');
      fs.writeFileSync(path.join(dir, 'enums.prl'),
        'enum First {\n  a { description "a" }\n}\n\nenum Second {\n  b { description "b" }\n}\n\nenum Third {\n  c { description "c" }\n}\n');
      const session = openPackagePayload(dir);
      const baseline = freshWorking(session);
      const working = freshWorking(session);
      deleteInList((a: Standard) => a.enums, 'Second').apply(working);

      const plan = planPackageSave(baseline, working, session);
      expect(plan.writes.map((w) => w.path)).toEqual(['enums.prl']);
      expect(plan.writes[0]!.text).toBe(
        'enum First {\n  a { description "a" }\n}\n\nenum Third {\n  c { description "c" }\n}\n',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('the recombination is byte-clean: written + untouched files reload to the working model', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-com-'));
    try {
      const dir = path.join(root, 'pkg-commented');
      fs.cpSync(path.join(FIXTURES, 'pkg-commented'), dir, { recursive: true });
      const session = openPackagePayload(dir);
      const baseline = freshWorking(session);
      const working = freshWorking(session);
      updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble gadgets v2' }).apply(working);
      createElement('dataclass', 'Sprocket').apply(working);
      deleteInList((a: Standard) => a.enums, 'GadgetKind').apply(working);

      const plan = planPackageSave(baseline, working, session);
      expect(plan.writes.map((w) => w.path)).toEqual(['model/main.prl']);
      for (const w of plan.writes) fs.writeFileSync(path.join(dir, w.path), w.text);

      const reloaded = loadPackageWithProvenance(dir);
      expect(dump(reloaded.standard)).toBe(dump(working));

      // The untouched file keeps its authored bytes — comments and all.
      expect(fs.readFileSync(path.join(dir, 'requirements.prl'), 'utf8'))
        .toBe(fs.readFileSync(path.join(FIXTURES, 'pkg-commented/requirements.prl'), 'utf8'));
      // The touched file kept every authored comment line.
      const written = fs.readFileSync(path.join(dir, 'model/main.prl'), 'utf8');
      for (const line of commentLines(fs.readFileSync(path.join(FIXTURES, 'pkg-commented/model/main.prl'), 'utf8'))) {
        expect(written).toContain(line);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('wave 2 — the provenance re-base (applyPlanToSession)', () => {
  it('a second save splices the NEW bytes — spans shift, never stale', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble gadgets v2' }).apply(working);

    const plan1 = planPackageSave(baseline, working, session);
    const session2 = applyPlanToSession(session, plan1);

    // The re-based session carries the new bytes and shifted spans.
    const text1 = plan1.writes[0]!.text;
    expect(authoredText(session2, 'model/main.prl')).toBe(text1);
    const span2 = spanOf(session2, 'processes', 'assemble');
    expect(text1.slice(span2.start.offset, span2.end.offset))
      .toBe('process assemble {\n  name "Assemble gadgets v2"\n}');

    // The second save: the baseline is the saved state, the edit lands
    // on the re-based spans.
    const baseline2 = load(dump(working), { strict: true });
    baseline2.packageManifest = structuredClone(session.manifest);
    updateElement((a: Standard) => a.processes, 'assemble', { name: 'Assemble gadgets v3' }).apply(working);

    const plan2 = planPackageSave(baseline2, working, session2);
    expect(plan2.writes.map((w) => w.path)).toEqual(['model/main.prl']);
    expect(plan2.warnings).toEqual([]);
    expect(plan2.writes[0]!.text).toBe(
      text1.slice(0, span2.start.offset)
        + 'process assemble {\n  name "Assemble gadgets v3"\n}'
        + text1.slice(span2.end.offset),
    );
  });

  it('a construct added then re-edited splices its appended span (no canonical fallback)', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    createElement('dataclass', 'Sprocket').apply(working);

    const plan1 = planPackageSave(baseline, working, session);
    const session2 = applyPlanToSession(session, plan1);
    // The appended construct now has a provenance span in the new text.
    const text1 = plan1.writes[0]!.text;
    const span2 = spanOf(session2, 'dataclasses', 'Sprocket');
    expect(text1.slice(span2.start.offset, span2.end.offset)).toBe('class Sprocket {\n}');

    const baseline2 = load(dump(working), { strict: true });
    baseline2.packageManifest = structuredClone(session.manifest);
    addAttribute('Sprocket', {
      id: 'tooth_count', type: 'decimal', modality: 'SHALL',
      cardinality: '[1..1]', definition: '', ref: [], satisfy: [],
    }).apply(working);

    const plan2 = planPackageSave(baseline2, working, session2);
    expect(plan2.writes.map((w) => w.path)).toEqual(['model/main.prl']);
    expect(plan2.warnings).toEqual([]);
    // The second write is the first write's text with ONLY Sprocket's
    // appended span replaced.
    const written2 = plan2.writes[0]!.text;
    expect(written2.slice(0, span2.start.offset)).toBe(text1.slice(0, span2.start.offset));
    expect(written2.endsWith(text1.slice(span2.end.offset))).toBe(true);
    expect(written2).toContain('tooth_count: decimal');
    expect(load(written2, { strict: true }).dataclasses.find((d) => d.id === 'Sprocket')?.attributes)
      .toHaveLength(1);
  });

  it('the re-base drops removed constructs and keeps untouched files’ provenance verbatim', () => {
    const { session, baseline } = openCommented();
    const working = freshWorking(session);
    deleteInList((a: Standard) => a.enums, 'GadgetKind').apply(working);

    const plan = planPackageSave(baseline, working, session);
    const session2 = applyPlanToSession(session, plan);

    expect(session2.provenance.constructs['enums']?.['GadgetKind']).toBeUndefined();
    // The requirement lived in the untouched file: identical entry.
    expect(session2.provenance.constructs['requirements']?.['/req/com/mass'])
      .toEqual(session.provenance.constructs['requirements']?.['/req/com/mass']);
    // The class after the removal shifted exactly by the removed bytes.
    const before = spanOf(session, 'dataclasses', 'Gadget#data');
    const after = spanOf(session2, 'dataclasses', 'Gadget#data');
    const removedBytes = plan.writes[0]!.text.length - authoredText(session, 'model/main.prl').length;
    expect(after.start.offset - before.start.offset).toBe(removedBytes);
    expect(after.end.offset - before.end.offset).toBe(removedBytes);
  });
});

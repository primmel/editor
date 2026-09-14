// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 05, slice 2 — the edition diff/publish flow, proven:
//   - the fixture pair (pkg-ed-old → pkg-ed-new) diffs as the edition
//     comparison it is (same package id, new version): all four change
//     groups populated, the per-tier tallies exact;
//   - the panel's derivation helpers (tier rows, the label suggestion
//     and guard, the moved-anchor summary);
//   - the declare-edition command (newest-first prepend, exact undo,
//     the session's baseline manifest untouched);
//   - the finalize save path: prepend → the comment-true plan writes
//     the manifest canonically and the written package RELOADS with
//     the new editions set;
//   - the release-note draft (markdown): per-tier counts, then the
//     element lines — deterministic under a fixed date.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffStandards, load, loadPackageWithProvenance } from '@primmel/primmel';
import {
  editionDiffGroups,
  editionLabelError,
  editionTierRows,
  movedAnchorSummary,
  prependEdition,
  releaseNoteDraft,
  releaseNoteFileName,
  suggestedEditionLabel,
} from '../edition';
import { planPackageSave } from '../package-save';
import { openPackagePayload } from '../../../scripts/package-open';

const OLD_DIR = path.resolve(import.meta.dirname, 'fixtures/pkg-ed-old');
const NEW_DIR = path.resolve(import.meta.dirname, 'fixtures/pkg-ed-new');

function openedPair() {
  const oldPayload = openPackagePayload(OLD_DIR);
  const newPayload = openPackagePayload(NEW_DIR);
  const base = load(oldPayload.dump, { strict: true });
  base.packageManifest = oldPayload.manifest;
  const working = load(newPayload.dump, { strict: true });
  working.packageManifest = newPayload.manifest;
  return { oldPayload, newPayload, base, working };
}

describe('05 slice 2 — the edition diff over the fixture pair', () => {
  const { base, working } = openedPair();
  const diff = diffStandards(base, working);

  it('reads as an edition comparison: same package id, new version', () => {
    expect(diff.editionComparison).toBe(true);
    expect(diff.aLabel).toBe('pkg-ed@1.0.0');
    expect(diff.bLabel).toBe('pkg-ed@2.0.0');
    expect(diff.empty).toBe(false);
  });

  it('all four change groups are populated from the fixture edits', () => {
    expect(diff.added.map((e) => e.key)).toEqual(['requirements:/req/ed/resolution', 'terms:gamma']);
    expect(diff.removed.map((e) => e.key)).toEqual(['terms:beta']);
    expect(diff.changed.map((e) => e.key)).toEqual(['terms:alpha']);
    expect(diff.changed[0].aspects).toEqual(['statement']);
    expect(diff.changed[0].fields).toEqual(['definition']);
    expect(diff.moved.map((e) => e.key)).toEqual(['requirements:/req/ed/stability']);
  });

  it('the per-tier tallies are exact (foundations churn, secondary gains + moves)', () => {
    expect(diff.byTier.foundations).toEqual({ added: 1, removed: 1, changed: 1, moved: 0, unchanged: 0 });
    expect(diff.byTier.secondary).toEqual({ added: 1, removed: 0, changed: 0, moved: 1, unchanged: 0 });
    expect(diff.byTier.primary).toEqual({ added: 0, removed: 0, changed: 0, moved: 0, unchanged: 0 });
  });

  it('the tier rows keep all five tiers, quiet ones flagged (never dropped)', () => {
    const rows = editionTierRows(diff);
    expect(rows.map((r) => r.tier)).toEqual(['foundations', 'primary', 'secondary', 'tertiary', 'cross-cutting']);
    expect(rows.find((r) => r.tier === 'foundations')?.quiet).toBe(false);
    expect(rows.find((r) => r.tier === 'tertiary')?.quiet).toBe(true);
  });

  it('an unchanged pair diffs empty', () => {
    const same = diffStandards(base, load(openPackagePayload(OLD_DIR).dump, { strict: true }));
    expect(same.empty).toBe(true);
  });
});

describe('05 slice 2 — the label suggestion + guard', () => {
  const { working } = openedPair();

  it('the suggestion is the current year (the OIML edition convention)', () => {
    expect(suggestedEditionLabel(new Date(2026, 5, 1))).toBe('2026');
    expect(suggestedEditionLabel()).toBe(String(new Date().getFullYear()));
  });

  it('the guard refuses the empty label and the duplicate, passes a fresh one', () => {
    const manifest = working.packageManifest!;
    expect(manifest.editions).toEqual(['2025']);
    expect(editionLabelError(manifest, '  ')).toContain('empty');
    expect(editionLabelError(manifest, '2025')).toContain('already declared');
    expect(editionLabelError(manifest, '2026')).toBeNull();
    expect(editionLabelError(null, '2026')).toContain('no package manifest');
  });
});

describe('05 slice 2 — the declare-edition command', () => {
  it('prepends newest-first, replaces the manifest object, and reverts to the exact prior reference', () => {
    const { working, newPayload } = openedPair();
    const before = working.packageManifest!;
    const cmd = prependEdition('2026');
    expect(cmd.label).toContain('2026');
    cmd.apply(working);
    expect(working.packageManifest!.editions).toEqual(['2026', '2025']);
    expect(working.packageManifest).not.toBe(before);
    // The session's baseline manifest is untouched (the save's
    // manifest-change detection compares against it by value).
    expect(before.editions).toEqual(['2025']);
    expect(newPayload.manifest.editions).toEqual(['2025']);
    cmd.revert(working);
    expect(working.packageManifest).toBe(before);
  });

  it('refuses the loose buffer (no manifest)', () => {
    const { working } = openedPair();
    working.packageManifest = null;
    expect(() => prependEdition('2026').apply(working)).toThrow('no package manifest');
  });
});

describe('05 slice 2 — the finalize save path (prepend → the comment-true plan)', () => {
  it('the manifest write carries the new editions set and the written package reloads', () => {
    const { newPayload, working } = openedPair();
    const baseline = load(newPayload.dump, { strict: true });

    prependEdition('2026').apply(working);
    const plan = planPackageSave(baseline, working, newPayload);
    expect(plan.writes).toHaveLength(1);
    const write = plan.writes[0];
    expect(write.path).toBe('package.primmel');
    expect(write.changed).toEqual(['package manifest']);
    expect(write.text).toContain('editions { 2026 2025 }');

    // The write round-trips: apply it to a temp copy and reload — the
    // new editions set parses back (bare tokens, newest first).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-edition-test-'));
    try {
      fs.cpSync(NEW_DIR, tmp, { recursive: true });
      fs.writeFileSync(path.join(tmp, write.path), write.text);
      const reloaded = loadPackageWithProvenance(tmp);
      expect(reloaded.standard.packageManifest?.editions).toEqual(['2026', '2025']);
      expect(reloaded.standard.packageManifest?.version).toBe('2.0.0');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('the draft never lands in the plan: only package files are written', () => {
    const { newPayload, working } = openedPair();
    const baseline = load(newPayload.dump, { strict: true });
    prependEdition('2026').apply(working);
    const plan = planPackageSave(baseline, working, newPayload);
    for (const w of plan.writes) {
      expect(w.path.endsWith('.md')).toBe(false);
      expect(w.path).not.toContain('release-notes');
    }
  });
});

describe('05 slice 2 — the release-note draft', () => {
  const { base, working } = openedPair();
  const diff = diffStandards(base, working);
  const note = releaseNoteDraft(diff, { packageId: 'pkg-ed', edition: '2026', date: '2026-09-14' });

  it('opens with the edition header and the diff provenance', () => {
    expect(note).toContain('# pkg-ed — edition 2026 release notes (draft)');
    expect(note).toContain('pkg-ed@1.0.0 → pkg-ed@2.0.0');
    expect(note).toContain('2026-09-14');
    expect(note).toContain('the release act stays in git + CI');
  });

  it('carries the per-tier counts, then the element lines per group', () => {
    expect(note).toContain('| tier | added | removed | changed | moved | unchanged |');
    expect(note).toContain('| foundations | 1 | 1 | 1 | 0 | 0 |');
    expect(note).toContain('| secondary | 1 | 0 | 0 | 1 | 0 |');
    expect(note).toContain('| **total** | **2** | **1** | **1** | **1** | **0** |');

    expect(note).toContain('## Added\n\n- `requirements//req/ed/resolution` (secondary)\n- `terms/gamma` (foundations)');
    expect(note).toContain('## Removed\n\n- `terms/beta` (foundations)');
    expect(note).toContain('## Changed\n\n- `terms/alpha` (foundations) — statement (fields: definition)');
    expect(note).toContain('## Moved (re-anchored)\n\n- `requirements//req/ed/stability` (secondary) — bindsTo: ["model.parameters.zero"] → ["model.parameters.span"]');
  });

  it('omits the mapping and clause-drift sections when the diff carries none', () => {
    expect(note).not.toContain('## Mappings');
    expect(note).not.toContain('## Clause drift');
  });

  it('an empty diff still notes the absence of changes', () => {
    const same = diffStandards(base, load(openPackagePayload(OLD_DIR).dump, { strict: true }));
    const emptyNote = releaseNoteDraft(same, { packageId: 'pkg-ed', edition: '2026', date: '2026-09-14' });
    expect(emptyNote).toContain('_No element changes against the base._');
    expect(emptyNote).not.toContain('## Added');
  });

  it('the file name is package- and edition-scoped, filesystem-safe', () => {
    expect(releaseNoteFileName('pkg-ed', '2026')).toBe('pkg-ed-2026-release-notes.md');
    expect(releaseNoteFileName('pkg-ed', '2026 draft 1')).toBe('pkg-ed-2026-draft-1-release-notes.md');
  });
});

describe('05 slice 2 — the panel group derivation', () => {
  it('the groups carry the rows with their sub-lines, in the panel order, empty groups dropped', () => {
    const { base, working } = openedPair();
    const groups = editionDiffGroups(diffStandards(base, working));
    expect(groups.map((g) => g.status)).toEqual(['added', 'removed', 'changed', 'moved']);
    const changed = groups.find((g) => g.status === 'changed')!;
    expect(changed.rows).toHaveLength(1);
    expect(changed.rows[0].key).toBe('terms:alpha');
    expect(changed.rows[0].sub).toBe('statement (fields: definition)');
    const moved = groups.find((g) => g.status === 'moved')!;
    expect(moved.rows[0].sub).toBe('bindsTo: ["model.parameters.zero"] → ["model.parameters.span"]');
    expect(groups.find((g) => g.status === 'added')!.rows.every((r) => r.sub === null)).toBe(true);
  });

  it('an empty diff has no groups', () => {
    const base = openedPair().base;
    expect(editionDiffGroups(diffStandards(base, base))).toEqual([]);
  });
});

describe('05 slice 2 — the moved-anchor summary', () => {  it('renders only the differing anchor fields', () => {
    const { base, working } = openedPair();
    const moved = diffStandards(base, working).moved[0];
    expect(movedAnchorSummary(moved)).toBe('bindsTo: ["model.parameters.zero"] → ["model.parameters.span"]');
  });

  it('falls back to the raw pair when the aspects are not field objects', () => {
    expect(movedAnchorSummary({ key: 'k', id: 'i', kind: 'processes', tier: 'tertiary', from: 'x', to: 'y' }))
      .toBe('x → y');
  });
});

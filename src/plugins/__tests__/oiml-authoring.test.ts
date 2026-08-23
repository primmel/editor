// ─────────────────────────────────────────────────────────────────────
// TODO.editor/40 — the OIML-CS authoring audit's proofs:
//   - the plugin contract: the OIML plugin contributes the requirement
//     and conformance-test inspectors (the registry's inspectors slot)
//     and the package-manifest panel;
//   - the command path: a requirement edited through updateElement
//     round-trips — the edited model dumps, re-parses and validates
//     clean, and the revert chain restores the byte-exact baseline
//     (cs.prl stays byte-stable through the command path);
//   - the manifest: a package.primmel model carries id/kind/uses/
//     requires/provides for the panel.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, load, validate } from '@primmel/primmel';
import { updateElement, type Command } from '../../lib/commands';
import { oimlPlugin } from '../oiml';

const MODEL = readFileSync(join(__dirname, '../../../demo/oiml-cs/model.prl'), 'utf8');
// The package-manifest fixture lives in a sibling repo (oimlsmart/smart);
// the test reads it when available and skips the package-manifest assertion
// when the local checkout isn't present (e.g. in CI). The fixture is
// oiml-smart-core: the former oiml-cs package's content merged into it on
// 2026-08-13 (its own manifest description says so), so it is also the
// retarget for the wave's original oiml-cs path.
const PACKAGE_PATH = join(__dirname, '../../../../../oimlsmart/smart/primmel-packages/oiml-smart-core/package.primmel');
const PACKAGE: string | null = existsSync(PACKAGE_PATH)
  ? readFileSync(PACKAGE_PATH, 'utf8')
  : null;

describe('40 — the plugin contract', () => {
  it('the OIML plugin contributes the program inspectors', () => {
    const types = (oimlPlugin.inspectors ?? []).map(i => i.type);
    expect(types).toContain('requirement');
    expect(types).toContain('conformanceTest');
  });

  it('the OIML plugin contributes the package-manifest panel', () => {
    const panels = (oimlPlugin.panels ?? []).map(p => p.id);
    expect(panels).toContain('package-manifest');
  });
});

describe('40 — the command path', () => {
  it('a requirement edited through updateElement round-trips; the revert chain is byte-exact', () => {
    const ast = load(MODEL, { strict: true });
    const baseline = dump(ast);
    const req = ast.requirements.find(r => r.id === '/req/cs/sample-count')!;
    expect(req.source?.doc).toMatch(/^PD-05 §/);

    const listOf = (a: typeof ast) => a.requirements;
    // The serializer walks sourceRefs (aliased with source) — patch both.
    const editedSource = { doc: 'PD-05 §4.2.5', clause: '4.2.5' };
    const commands: Command[] = [
      updateElement(listOf, req.id, { name: 'Sample count (edited)' }, 'edit name'),
      updateElement(listOf, req.id, { obligation: 'should' }, 'edit obligation'),
      updateElement(listOf, req.id, { source: editedSource, sourceRefs: [editedSource] }, 'edit source'),
      updateElement(listOf, req.id, { verificationMethod: 'review' }, 'edit verification'),
    ];
    for (const c of commands) c.apply(ast);

    // The edited model carries the edits and still validates clean.
    const edited = ast.requirements.find(r => r.id === '/req/cs/sample-count')!;
    expect(edited.name).toBe('Sample count (edited)');
    expect(edited.obligation).toBe('should');
    expect(edited.source).toEqual({ doc: 'PD-05 §4.2.5', clause: '4.2.5' });
    expect(edited.verificationMethod).toBe('review');
    const roundTripped = load(dump(ast), { strict: true });
    expect(validate(roundTripped)).toEqual([]);
    expect(roundTripped.requirements.find(r => r.id === '/req/cs/sample-count')!.source?.clause).toBe('4.2.5');

    // Revert in reverse: the byte-exact baseline returns.
    for (const c of [...commands].reverse()) c.revert(ast);
    expect(dump(ast)).toBe(baseline);
  });
});

describe('40 — the package manifest', () => {
  // Skipped in CI — the oiml-smart checkout isn't present there. Run locally
  // with the sibling oimlsmart/smart repo at the expected path.
  const itIfLocal = PACKAGE ? it : it.skip;
  itIfLocal('the oiml-smart-core package.primmel parses with id/kind/uses/requires/provides', () => {
    const ast = load(PACKAGE!, { strict: true });
    const manifest = ast.packageManifest!;
    expect(manifest.id).toBe('oiml-smart-core');
    expect(manifest.kind).toBe('core');
    expect(manifest.uses).toEqual(['iso-iec-17000', 'iso-iec-17065', 'iso-iec-17025', 'iso-iec-17067']);
    expect(manifest.requires).toEqual(manifest.uses);
    expect(manifest.provides).toContain('oiml-cs');
  });
});

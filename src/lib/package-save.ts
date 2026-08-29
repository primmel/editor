// ─────────────────────────────────────────────────────────────────────
// The package-aware save (TODO.editor wave 1) — the inverse of the
// provenance load. The kernel attests where every construct came from
// (PackageProvenance); the plan re-splits the working AST by source
// file (the kernel's groupBySourceFile projection), and only files
// whose constructs actually changed (the kernel's diffStandards) get a
// write — untouched files keep their authored bytes (comments, clause
// banners, ordering). Constructs authored in-session route to the file
// that already carries most of their kind; constructs owned by IMPORTED
// packages are never written (they are context, not the unit of work).
//
// Wave 2 owns the comment-true save (span splices); this wave writes
// the canonical per-file dump for touched files only.
// ─────────────────────────────────────────────────────────────────────

import {
  diffStandards, dump, dumpPackage, groupBySourceFile,
  type ConstructRef, type Standard,
} from '@primmel/primmel';
import type { PackageOpenResult } from './package';

/** The top-level construct collections (the kernel's provenance field
 *  names ARE these Standard keys): the tier table's 49 plus the
 *  tier-less eight. The unit test proves the list complete against a
 *  real package load. */
export const CONSTRUCT_FIELDS = [
  'terms', 'references', 'roles', 'quantityRegisters', 'enums', 'variables', 'figures',
  'activityArchetypes', 'connectorProfiles', 'subjects', 'instruments', 'attributeDefinitions',
  'capabilities', 'behaviors', 'conditionSets', 'instances', 'duals', 'artifactDefinitions',
  'artifactInstances', 'requirements', 'requirementClasses', 'conformanceTests', 'conformanceClasses',
  'forms', 'subforms', 'symbols', 'calculations', 'verdicts', 'tables', 'testPointSets',
  'referenceMaterials', 'processes', 'pages', 'dataclasses', 'regs', 'gateways', 'events',
  'approvals', 'stateMachines', 'monitors', 'passports', 'viewProfiles', 'provisions', 'notes',
  'invariants', 'testSequences', 'formulasUsed', 'links', 'texts',
  'comments', 'mapProfiles', 'competenceKinds', 'predicates', 'constraints',
  'discrepancyRecords', 'dataspaces', 'policies',
] as const satisfies readonly (keyof Standard)[];

export type ConstructField = (typeof CONSTRUCT_FIELDS)[number];

/** A construct reference with the field narrowed to a known collection
 *  (structurally a kernel ConstructRef — groupBySourceFile takes it). */
export interface FileRef {
  field: ConstructField;
  id: string;
}

/** The runtime boundary: a top-level construct's identity — the kernel's
 *  provenance keys every collection on `id`, except the entity-keyed
 *  state machines, keyed on `entityName` (verified against the kernel's
 *  PackageProvenance). */
export function constructId(el: object): string | undefined {
  if ('id' in el && typeof el.id === 'string') return el.id;
  if ('entityName' in el && typeof el.entityName === 'string') return el.entityName;
  return undefined;
}

export interface PackageSaveFilePlan {
  /** Package-relative path. */
  path: string;
  /** The bytes to write (the canonical dump of the file's constructs). */
  text: string;
  added: string[];
  removed: string[];
  changed: string[];
}

/** An edit that landed on an IMPORTED package's construct — surfaced,
 *  never written (the import is not the unit of work). */
export interface ForeignTouch {
  package: string;
  kind: string;
  id: string;
  status: 'changed' | 'removed';
}

export interface PackageSavePlan {
  writes: PackageSaveFilePlan[];
  foreignTouched: ForeignTouch[];
  warnings: string[];
  /** True when nothing would be written and nothing needs saying. */
  empty: boolean;
}

/** Serialize one file's worth of constructs: a Standard clone carrying
 *  only this file's members, dumped, minus the metadata block the dump
 *  always emits (kept only when the metadata construct itself lives in
 *  this file). The skeleton head is computed, never hardcoded. */
function dumpFileConstructs(
  working: Standard,
  members: Map<ConstructField, Set<string>>,
  includeMetadata: boolean,
  skeletonHead: string,
): string {
  const partial = { ...working, packageManifest: null };
  for (const f of CONSTRUCT_FIELDS) {
    const keep = members.get(f);
    const items = keep
      ? working[f].filter((el) => {
          const id = constructId(el);
          return id !== undefined && keep.has(id);
        })
      : [];
    Object.assign(partial, { [f]: items });
  }
  const full = dump(partial);
  return includeMetadata || !full.startsWith(skeletonHead) ? full : full.slice(skeletonHead.length);
}

/** Compute the per-file write plan for the working AST against the
 *  loaded baseline, honoring the package's provenance. */
export function planPackageSave(
  baseline: Standard,
  working: Standard,
  session: PackageOpenResult,
): PackageSavePlan {
  const provenance = session.provenance;
  const warnings: string[] = [];
  const foreignTouched: ForeignTouch[] = [];
  const diff = diffStandards(baseline, working);
  const key = (kind: string, id: string) => `${kind}:${id}`;
  const changedKeys = new Set([...diff.changed, ...diff.moved].map((e) => key(e.kind, e.id)));
  const removedKeys = new Set(diff.removed.map((e) => key(e.kind, e.id)));
  const addedKeys = new Set(diff.added.map((e) => key(e.kind, e.id)));

  const dir = session.dir.replace(/\/+$/, '');
  const isRootFile = (absFile: string) => absFile.startsWith(dir + '/');
  const relOf = (absFile: string) => absFile.slice(dir.length + 1);

  // The current construct census, partitioned by source file — the
  // kernel's inverse projection. Imports land in byFile too (keyed by
  // their own absolute paths) and are filtered to the root below.
  const refs: FileRef[] = [];
  for (const f of CONSTRUCT_FIELDS) {
    for (const el of working[f]) {
      const id = constructId(el);
      if (id !== undefined) refs.push({ field: f, id });
    }
  }
  const grouped = groupBySourceFile(provenance, refs satisfies readonly ConstructRef[]);

  // Route the unassigned (authored in-session): the root file holding
  // the most constructs of that field at load, else the first content
  // file. groupBySourceFile cannot know the package's conventions.
  const fieldCounts = new Map<string, Map<string, number>>();
  for (const [field, ids] of Object.entries(provenance.constructs)) {
    for (const src of Object.values(ids)) {
      if (!isRootFile(src.file)) continue;
      const perFile = fieldCounts.get(field) ?? new Map<string, number>();
      perFile.set(src.file, (perFile.get(src.file) ?? 0) + 1);
      fieldCounts.set(field, perFile);
    }
  }
  const fieldHome = new Map<string, string>();
  for (const [field, perFile] of fieldCounts) {
    let best: string | undefined;
    let bestN = -1;
    for (const [file, n] of perFile) {
      if (n > bestN) { best = file; bestN = n; }
    }
    if (best) fieldHome.set(field, best);
  }
  const firstContent = session.files.find((f) => f.role === 'content');
  const fallbackFile = firstContent ? `${dir}/${firstContent.path}` : null;

  const byFile = new Map<string, FileRef[]>();
  for (const [file, fileRefs] of grouped.byFile) byFile.set(file, [...fileRefs]);
  const unrouted: FileRef[] = [];
  for (const ref of grouped.unassigned as readonly FileRef[]) {
    const home = fieldHome.get(ref.field) ?? fallbackFile;
    if (!home) {
      unrouted.push(ref);
      continue;
    }
    const list = byFile.get(home) ?? [];
    list.push(ref);
    byFile.set(home, list);
  }
  if (unrouted.length > 0) {
    warnings.push(`${unrouted.length} new construct(s) have no home file (the package has no content file for their kind) — not written`);
  }

  // Foreign edits: diff entries whose constructs live OUTSIDE the root.
  for (const e of [...diff.changed, ...diff.moved]) {
    const src = provenance.constructs[e.kind]?.[e.id];
    if (src && !isRootFile(src.file)) {
      foreignTouched.push({ package: src.package ?? 'unknown', kind: e.kind, id: e.id, status: 'changed' });
    }
  }
  for (const e of diff.removed) {
    const src = provenance.constructs[e.kind]?.[e.id];
    if (src && !isRootFile(src.file)) {
      foreignTouched.push({ package: src.package ?? 'unknown', kind: e.kind, id: e.id, status: 'removed' });
    }
  }

  // The metadata block: packages keep none per file; when the loaded
  // provenance has a home for it, that file keeps the block. An edit
  // without a home is surfaced, not silently dropped.
  const metadataHome = provenance.constructs['metadata']?.[''];
  const metaChanged = JSON.stringify(baseline.meta) !== JSON.stringify(working.meta);
  if (metaChanged && !metadataHome) {
    warnings.push('the metadata block changed but no package file carries one — the edit is not written');
  }

  // The skeleton head: the dump of a construct-less clone of the working
  // model — exactly the metadata block the dump prepends to every file.
  const skeleton = { ...working, packageManifest: null };
  for (const f of CONSTRUCT_FIELDS) Object.assign(skeleton, { [f]: [] });
  const skeletonHead = dump(skeleton);

  const writes: PackageSaveFilePlan[] = [];
  for (const [absFile, fileRefs] of byFile) {
    if (!isRootFile(absFile)) continue;
    if (provenance.manifest && absFile === provenance.manifest) continue; // the manifest is handled below

    const baselineIds = new Set<string>();
    for (const [field, ids] of Object.entries(provenance.constructs)) {
      for (const [id, src] of Object.entries(ids)) {
        if (src.file === absFile) baselineIds.add(key(field, id));
      }
    }
    const currentIds = new Set(fileRefs.map((r) => key(r.field, r.id)));
    const removed = [...baselineIds].filter((k) => removedKeys.has(k)).map((k) => k.slice(k.indexOf(':') + 1));
    const changed = [...currentIds].filter((k) => changedKeys.has(k)).map((k) => k.slice(k.indexOf(':') + 1));
    const added = [...currentIds].filter((k) => addedKeys.has(k)).map((k) => k.slice(k.indexOf(':') + 1));
    const metadataHere = metadataHome?.file === absFile && metaChanged;
    if (removed.length === 0 && changed.length === 0 && added.length === 0 && !metadataHere) continue;

    const members = new Map<ConstructField, Set<string>>();
    for (const r of fileRefs) {
      const set = members.get(r.field) ?? new Set<string>();
      set.add(r.id);
      members.set(r.field, set);
    }
    const text = dumpFileConstructs(working, members, metadataHome?.file === absFile, skeletonHead);
    writes.push({ path: relOf(absFile), text, added, removed, changed });
  }

  // The manifest is not part of the construct dump — written via the
  // kernel's dumpPackage when (and only when) it changed. The baseline
  // manifest is the SESSION's (a dump-parsed baseline AST carries none
  // — the dump gap), the working one rides the AST.
  const manifestChanged =
    JSON.stringify(session.manifest) !== JSON.stringify(working.packageManifest ?? null);
  if (manifestChanged && provenance.manifest && working.packageManifest) {
    const metaBlock = metadataHome?.file === provenance.manifest
      ? dumpFileConstructs(working, new Map(), true, skeletonHead)
      : '';
    writes.push({
      path: relOf(provenance.manifest),
      text: metaBlock + dumpPackage(working.packageManifest),
      added: [], removed: [], changed: ['package manifest'],
    });
  }

  // The plan's write order follows the opened file inventory.
  const order = new Map(session.files.map((f, i) => [f.path, i]));
  writes.sort((a, b) => (order.get(a.path) ?? 999) - (order.get(b.path) ?? 999));

  return {
    writes,
    foreignTouched,
    warnings,
    empty: writes.length === 0 && foreignTouched.length === 0 && warnings.length === 0,
  };
}

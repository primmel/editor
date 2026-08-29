// ─────────────────────────────────────────────────────────────────────
// The package-aware save (TODO.editor waves 1+2) — the inverse of the
// provenance load. The kernel attests where every construct came from
// (PackageProvenance: the source file AND the construct's byte span in
// it); the plan re-splits the working AST by source file (the kernel's
// groupBySourceFile projection), and only files whose constructs
// actually changed (the kernel's diffStandards) get a write.
//
// Wave 2 owns the comment-true write: a touched file is NOT re-dumped
// canonically. Its authored bytes carry over verbatim and only the
// edited constructs' own spans are spliced — comments, clause banners,
// authored whitespace and construct order outside those spans survive
// byte-identical (the SSOT doctrine; the audit's G4). The splices:
//
//   changed  → the span is replaced by the construct's canonical dump
//   removed  → the span (plus its line ending) drops out; a doubled
//              blank line at the junction collapses to one
//   added    → constructs authored in-session append to their kind's
//              home file in canonical form, after the authored bytes
//
// Each write also carries the spanMap — every construct's span in the
// NEW text — so a successful write can re-base the session's provenance
// (applyPlanToSession) and a second save splices the new bytes, never
// stale offsets. Constructs owned by IMPORTED packages are never
// written (they are context, not the unit of work).
//
// Known limit: the manifest file rewrites canonically when it changes
// (the kernel attests no spans inside package.primmel).
// ─────────────────────────────────────────────────────────────────────

import {
  diffStandards, dump, dumpPackage, groupBySourceFile,
  type ConstructRef, type ConstructSource, type PackageProvenance,
  type ProvenancePosition, type Standard,
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

/** A construct's span in a file text (0-based offsets, end exclusive —
 *  the kernel's ProvenancePosition.offset semantics). */
export interface SpanOffsets {
  start: number;
  end: number;
}

export interface PackageSaveFilePlan {
  /** Package-relative path. */
  path: string;
  /** The bytes to write: the authored file with only the touched
   *  constructs' spans spliced (the comment-true write). */
  text: string;
  added: string[];
  removed: string[];
  changed: string[];
  /** Every construct's span in the NEW text, keyed field → id (the
   *  id-less metadata block keys as metadata → ''). The input to
   *  applyPlanToSession's provenance re-base. Empty for the manifest
   *  write (the kernel attests no spans inside package.primmel —
   *  except the metadata block when it lives there, which the write
   *  places itself). */
  spanMap: Record<string, Record<string, SpanOffsets>>;
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

/** One construct's canonical text (no trailing newline) — the splice
 *  replacement for a changed span and the append unit for an added
 *  construct. */
function dumpConstruct(
  working: Standard,
  field: ConstructField,
  id: string,
  skeletonHead: string,
): string {
  return dumpFileConstructs(working, new Map([[field, new Set([id])]]), false, skeletonHead)
    .replace(/\n+$/, '');
}

/** One splice against the authored text: [start, end) becomes text.
 *  field/id identify the construct for the span maintenance. */
interface SpliceEdit {
  start: number;
  end: number;
  text: string;
  field: string;
  id: string;
}

/** Apply ascending, non-overlapping edits; returns the new text and the
 *  NEW-text span of each edit's replacement. */
function applyEdits(
  authored: string,
  edits: SpliceEdit[],
): { text: string; placed: { edit: SpliceEdit; span: SpanOffsets }[] } {
  let out = '';
  let cursor = 0;
  const placed: { edit: SpliceEdit; span: SpanOffsets }[] = [];
  for (const e of edits) {
    out += authored.slice(cursor, e.start) + e.text;
    placed.push({ edit: e, span: { start: out.length - e.text.length, end: out.length } });
    cursor = e.end;
  }
  out += authored.slice(cursor);
  return { text: out, placed };
}

/** A removal's byte range: the construct's span, its own line ending,
 *  and the blank-line collapse — when the removed construct sat between
 *  blank lines, one survives, never two. */
function removalRange(authored: string, start: number, end: number): SpanOffsets {
  let s = start;
  let e = end;
  if (authored[e] === '\n') e++;
  if (authored[e] === '\n' && authored[s - 1] === '\n' && authored[s - 2] === '\n') s--;
  return { start: s, end: e };
}

/** The total byte shift an edit list applies at an offset (every edit
 *  strictly before the offset contributes its length delta). */
function shiftAt(edits: SpliceEdit[], offset: number): number {
  let delta = 0;
  for (const e of edits) {
    if (e.end <= offset) delta += e.text.length - (e.end - e.start);
  }
  return delta;
}

/** One removal, found via the provenance scan (removed constructs are
 *  absent from the working AST, so groupBySourceFile never sees them). */
interface RemovedRef {
  field: string;
  id: string;
  src: ConstructSource;
}

/** Build one touched file's comment-true write: the authored bytes with
 *  only the changed/removed spans spliced and the added constructs
 *  appended, plus the spanMap of the new text. Returns null when a
 *  construct that must be spliced has no usable span (defensive — the
 *  provenance load attests spans for every loaded construct); the file
 *  is then skipped with a warning rather than rewritten destructively. */
function planFileWrite(
  authored: string,
  working: Standard,
  fileRefs: readonly FileRef[],
  removedRefs: readonly RemovedRef[],
  changedKeys: ReadonlySet<string>,
  addedKeys: ReadonlySet<string>,
  metadata: { src?: ConstructSource; changed: boolean },
  skeletonHead: string,
  warnings: string[],
  relPath: string,
  srcOf: (field: string, id: string) => ConstructSource | undefined,
): { text: string; spanMap: Record<string, Record<string, SpanOffsets>> } | null {
  const key = (kind: string, id: string) => `${kind}:${id}`;
  const edits: SpliceEdit[] = [];

  // Changed constructs: the span rewrites to the canonical dump.
  for (const r of fileRefs) {
    if (!changedKeys.has(key(r.field, r.id))) continue;
    const src = srcOf(r.field, r.id);
    if (!src) {
      warnings.push(`${relPath}: ${r.field} ${r.id} changed but its source span is unknown — the file is not written (the edit stays in-session)`);
      return null;
    }
    edits.push({
      start: src.span.start.offset,
      end: src.span.end.offset,
      text: dumpConstruct(working, r.field, r.id, skeletonHead),
      field: r.field,
      id: r.id,
    });
  }

  // Removed constructs: the span drops out of the authored bytes.
  for (const rem of removedRefs) {
    const range = removalRange(authored, rem.src.span.start.offset, rem.src.span.end.offset);
    edits.push({ start: range.start, end: range.end, text: '', field: rem.field, id: rem.id });
  }

  // The metadata block is one more splicable construct (field metadata,
  // id '') when it lives in this file.
  if (metadata.changed) {
    if (!metadata.src) {
      warnings.push(`${relPath}: the metadata block changed but its source span is unknown — the file is not written (the edit stays in-session)`);
      return null;
    }
    edits.push({
      start: metadata.src.span.start.offset,
      end: metadata.src.span.end.offset,
      text: skeletonHead.replace(/\n+$/, ''),
      field: 'metadata',
      id: '',
    });
  }

  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i++) {
    if (edits[i]!.start < edits[i - 1]!.end) {
      warnings.push(`${relPath}: overlapping source spans — the file is not written (the edits stay in-session)`);
      return null;
    }
  }

  const applied = applyEdits(authored, edits);
  let text = applied.text;
  const spanMap: Record<string, Record<string, SpanOffsets>> = {};

  // The changed constructs' new spans come from the splice itself.
  for (const p of applied.placed) {
    if (p.edit.text === '') continue; // a removal places nothing
    (spanMap[p.edit.field] ??= {})[p.edit.id] = p.span;
  }

  // Untouched constructs shift by the edits before them; the authored
  // bytes inside their spans carry over verbatim.
  for (const r of fileRefs) {
    const k = key(r.field, r.id);
    if (changedKeys.has(k) || addedKeys.has(k)) continue;
    const src = srcOf(r.field, r.id);
    if (!src) {
      warnings.push(`${relPath}: ${r.field} ${r.id} has no source span — the file is not written`);
      return null;
    }
    const delta = shiftAt(edits, src.span.start.offset);
    (spanMap[r.field] ??= {})[r.id] = {
      start: src.span.start.offset + delta,
      end: src.span.end.offset + delta,
    };
  }

  // An unchanged metadata block shifts like any untouched construct.
  if (metadata.src && !metadata.changed) {
    const delta = shiftAt(edits, metadata.src.span.start.offset);
    (spanMap['metadata'] ??= {})[''] = {
      start: metadata.src.span.start.offset + delta,
      end: metadata.src.span.end.offset + delta,
    };
  }

  // Added constructs append in canonical form after the authored bytes,
  // one blank line between the old content and the new block.
  const addedRefs = fileRefs.filter((r) => addedKeys.has(key(r.field, r.id)));
  if (addedRefs.length > 0) {
    let sep = '';
    if (text.length > 0 && !text.endsWith('\n')) sep = '\n';
    if (text.trimEnd().length > 0) sep += '\n';
    let cursor = text.length + sep.length;
    const pieces = addedRefs.map((r) => dumpConstruct(working, r.field, r.id, skeletonHead));
    text += sep + pieces.map((p) => p + '\n').join('\n');
    addedRefs.forEach((r, i) => {
      const piece = pieces[i]!;
      (spanMap[r.field] ??= {})[r.id] = { start: cursor, end: cursor + piece.length };
      cursor += piece.length + 1 + (i < pieces.length - 1 ? 1 : 0);
    });
  }

  return { text, spanMap };
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

  // The metadata block: the provenance attests its home file and span
  // like any construct's (the id-less singleton keys as metadata → '').
  // An edit without a home is surfaced, not silently dropped.
  const metadataHome = provenance.constructs['metadata']?.[''];
  const metaChanged = JSON.stringify(baseline.meta) !== JSON.stringify(working.meta);
  if (metaChanged && !metadataHome) {
    warnings.push('the metadata block changed but no package file carries one — the edit is not written');
  }

  // Removed constructs per file: absent from the working AST, so the
  // provenance scan finds them (a file whose EVERY construct was
  // removed still gets its comment-true write).
  const removalsByFile = new Map<string, RemovedRef[]>();
  for (const [field, ids] of Object.entries(provenance.constructs)) {
    if (field === 'metadata') continue;
    for (const [id, src] of Object.entries(ids)) {
      if (!isRootFile(src.file)) continue;
      if (removedKeys.has(key(field, id))) {
        const list = removalsByFile.get(src.file) ?? [];
        list.push({ field, id, src });
        removalsByFile.set(src.file, list);
      }
    }
  }

  // The skeleton head: the dump of a construct-less clone of the working
  // model — exactly the metadata block the dump prepends to every file.
  const skeleton = { ...working, packageManifest: null };
  for (const f of CONSTRUCT_FIELDS) Object.assign(skeleton, { [f]: [] });
  const skeletonHead = dump(skeleton);

  const writes: PackageSaveFilePlan[] = [];

  // The touched-file candidates: files holding current constructs UNION
  // files holding removals (the all-removed file appears only here)
  // UNION the metadata block's home when only it changed (a file may
  // carry the metadata block and no constructs).
  const candidates = new Set<string>();
  for (const absFile of byFile.keys()) if (isRootFile(absFile)) candidates.add(absFile);
  for (const absFile of removalsByFile.keys()) candidates.add(absFile);
  if (metaChanged && metadataHome && isRootFile(metadataHome.file) && metadataHome.file !== provenance.manifest) {
    candidates.add(metadataHome.file);
  }

  for (const absFile of candidates) {
    if (provenance.manifest && absFile === provenance.manifest) continue; // the manifest is handled below
    const relPath = relOf(absFile);
    const fileRefs = byFile.get(absFile) ?? [];
    const removedRefs = removalsByFile.get(absFile) ?? [];

    const currentIds = new Set(fileRefs.map((r) => key(r.field, r.id)));
    const removed = removedRefs.map((r) => r.id);
    const changed = [...currentIds].filter((k) => changedKeys.has(k)).map((k) => k.slice(k.indexOf(':') + 1));
    const added = [...currentIds].filter((k) => addedKeys.has(k)).map((k) => k.slice(k.indexOf(':') + 1));
    const metadataHere = metadataHome?.file === absFile;
    if (removed.length === 0 && changed.length === 0 && added.length === 0 && !(metadataHere && metaChanged)) continue;

    const authored = session.files.find((f) => f.path === relPath)?.text;
    if (authored === undefined) {
      warnings.push(`${relPath}: the authored bytes are not in the session — the file is not written`);
      continue;
    }

    const built = planFileWrite(
      authored, working, fileRefs, removedRefs, changedKeys, addedKeys,
      { src: metadataHere ? metadataHome : undefined, changed: metadataHere && metaChanged },
      skeletonHead, warnings, relPath,
      (field, id) => {
        const src = provenance.constructs[field]?.[id];
        return src && src.file === absFile ? src : undefined;
      },
    );
    if (!built) continue;

    writes.push({ path: relPath, text: built.text, spanMap: built.spanMap, added, removed, changed });
  }

  // The manifest is not part of the construct dump — written via the
  // kernel's dumpPackage when (and only when) it changed, or when the
  // metadata block it carries changed. Canonical either way: the kernel
  // attests no spans inside package.primmel, so a commented manifest
  // file rewrites comment-less (the known limit, stated up top).
  const manifestChanged =
    JSON.stringify(session.manifest) !== JSON.stringify(working.packageManifest ?? null);
  const manifestMeta = metadataHome?.file === provenance.manifest && metaChanged;
  if ((manifestChanged || manifestMeta) && provenance.manifest && working.packageManifest) {
    const metaBlock = manifestMeta
      ? dumpFileConstructs(working, new Map(), true, skeletonHead)
      : '';
    const spanMap: Record<string, Record<string, SpanOffsets>> = {};
    if (manifestMeta) {
      spanMap['metadata'] = { '': { start: 0, end: skeletonHead.replace(/\n+$/, '').length } };
    }
    writes.push({
      path: relOf(provenance.manifest),
      text: metaBlock + dumpPackage(working.packageManifest),
      spanMap,
      added: [], removed: [],
      changed: manifestChanged ? ['package manifest'] : ['metadata'],
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

/** A line index over a written file's text: offset → the kernel's
 *  1-based line/col ProvenancePosition. */
function toPosition(lineStarts: readonly number[], offset: number): ProvenancePosition {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - lineStarts[lo]! + 1, offset };
}

/** Re-base the package session after a successful write (TODO.editor
 *  wave 2): the written files' bytes become the session's, and every
 *  construct's provenance span shifts to its place in the new text
 *  (each write's spanMap attests it — changed constructs placed by the
 *  splice, untouched ones shifted, added ones appended, removed ones
 *  dropped). Without this the NEXT save would splice stale offsets. */
export function applyPlanToSession(
  session: PackageOpenResult,
  plan: PackageSavePlan,
): PackageOpenResult {
  const dir = session.dir.replace(/\/+$/, '');
  const byAbs = new Map(plan.writes.map((w) => [`${dir}/${w.path}`, w]));

  const files = session.files.map((f) => {
    const w = byAbs.get(`${dir}/${f.path}`);
    return w ? { ...f, text: w.text } : f;
  });

  const constructs: PackageProvenance['constructs'] = {};
  const lineStartsByPath = new Map<string, number[]>();
  const lineStartsOf = (text: string, pathKey: string): number[] => {
    let starts = lineStartsByPath.get(pathKey);
    if (!starts) {
      starts = [0];
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
      lineStartsByPath.set(pathKey, starts);
    }
    return starts;
  };
  const place = (w: PackageSaveFilePlan, span: SpanOffsets): ConstructSource['span'] => {
    const starts = lineStartsOf(w.text, w.path);
    return { start: toPosition(starts, span.start), end: toPosition(starts, span.end) };
  };

  // Existing entries: untouched files keep theirs verbatim; written
  // files re-derive from the spanMap (absent = removed → dropped).
  for (const [field, ids] of Object.entries(session.provenance.constructs)) {
    for (const [id, src] of Object.entries(ids)) {
      const w = byAbs.get(src.file);
      if (!w) {
        (constructs[field] ??= {})[id] = src;
        continue;
      }
      const span = w.spanMap[field]?.[id];
      if (span) (constructs[field] ??= {})[id] = { ...src, span: place(w, span) };
    }
  }
  // Added constructs: spanMap entries with no prior entry.
  for (const w of plan.writes) {
    const abs = `${dir}/${w.path}`;
    for (const [field, ids] of Object.entries(w.spanMap)) {
      for (const [id, span] of Object.entries(ids)) {
        if (!constructs[field]?.[id]) {
          (constructs[field] ??= {})[id] = { file: abs, package: session.id, span: place(w, span) };
        }
      }
    }
  }

  return { ...session, files, provenance: { ...session.provenance, constructs } };
}

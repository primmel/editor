// ─────────────────────────────────────────────────────────────────────
// The workspace index (TODO.editor wave 05, audit G9 / the Paneron
// P-1 row) — the session's typed items, Imp/Ref/Doc: the open model
// (the unit of work — the mapper's IMP side), the registered reference
// models (the multi-reference lens registry), and the attached
// document (the doc-map mirror). A pure derivation over the session
// state; the WorkspacePanel renders it. Multi-model EDITING stays out
// of scope — a ref row's action drives the existing lens (activate +
// the mapping view), never a second editable AST.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { PackageOpenResult } from './package';
import type { DocumentModel } from './document-model';

/** The compact construct tally an item row carries. */
export interface WorkspaceCounts {
  processes: number;
  requirements: number;
  terms: number;
}

/** The open model — the unit of work (the mapper's IMP side). */
export interface WorkspaceImp {
  /** The manifest id (a package-carrying model), else the meta
   *  namespace, else 'model'. */
  id: string;
  title: string;
  /** The manifest's package tier (absent = an ordinary rec package),
   *  or 'model' for a loose single-file session. */
  kind: string;
  namespace: string;
  counts: WorkspaceCounts;
  /** Package sessions only: the root package's file inventory size. */
  files: number | null;
  /** The uses-composed import closure (package sessions). */
  imports: { id: string; constructs: number }[];
  /** The manifest's declared editions, newest first. */
  editions: string[];
}

/** One registered reference model (the mapper's REF lens). */
export interface WorkspaceRef {
  namespace: string;
  active: boolean;
  counts: WorkspaceCounts;
}

/** The attached document (the doc-map mirror). */
export interface WorkspaceDoc {
  title: string;
  urnBase: string;
  clauses: number;
  statements: number;
}

export interface WorkspaceIndex {
  imp: WorkspaceImp;
  refs: WorkspaceRef[];
  doc: WorkspaceDoc | null;
}

function countsOf(model: Standard): WorkspaceCounts {
  return {
    processes: model.processes.length,
    requirements: model.requirements.length,
    terms: model.terms.length,
  };
}

/** Derive the session's typed items. Reads the open model + the package
 *  session payload (never mutated — the AST stays the one truth), the
 *  mapper's reference registry, and the doc-mirror attachment. */
export function workspaceIndex(
  standard: Standard,
  pkg: PackageOpenResult | null,
  refs: Record<string, Standard>,
  activeNs: string | null,
  doc: DocumentModel | null,
): WorkspaceIndex {
  const manifest = standard.packageManifest ?? null;
  const imp: WorkspaceImp = {
    id: manifest?.id ?? (standard.meta?.namespace?.trim() || 'model'),
    title: manifest?.title ?? standard.meta?.title ?? '',
    kind: manifest ? (manifest.kind ?? 'rec') : 'model',
    namespace: standard.meta?.namespace ?? '',
    counts: countsOf(standard),
    files: pkg?.files.length ?? null,
    imports: (pkg?.imports ?? []).map(i => ({
      id: i.package,
      constructs: i.files.reduce((n, f) => n + f.constructs, 0),
    })),
    editions: manifest?.editions ?? [],
  };
  const refsList: WorkspaceRef[] = Object.entries(refs)
    .map(([namespace, model]) => ({ namespace, active: namespace === activeNs, counts: countsOf(model) }))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
  const docItem: WorkspaceDoc | null = doc
    ? { title: doc.title, urnBase: doc.urnBase, clauses: doc.clauses.length, statements: doc.statements.size }
    : null;
  return { imp, refs: refsList, doc: docItem };
}

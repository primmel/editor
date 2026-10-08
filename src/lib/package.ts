// ─────────────────────────────────────────────────────────────────────
// The package bridge (TODO.editor wave 1) — the types and fetchers for
// the dev server's package API (vite.config.ts). Opening a v3 PACKAGE
// directory runs the kernel's provenance load server-side (the loader
// is fs-bound); the browser receives the merged dump (the AST source),
// the provenance map (construct → source file), and the root package's
// file inventory. Saving writes the per-file plan, never the merged
// dump.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue, PackageManifest, PackageProvenance } from '@primmel/primmel';

/** One file of the opened (root) package — the unit of work. */
export interface PackageFileInfo {
  /** Package-relative path (e.g. "model/processes.prl"). */
  path: string;
  role: 'manifest' | 'content';
  /** Top-level constructs parsed from this file. */
  constructs: number;
  /** The authored bytes (root files only — imports ship structure only). */
  text: string;
}

/** One imported (uses-composed) package's structural footprint. */
export interface PackageImportInfo {
  package: string;
  files: { path: string; constructs: number }[];
}

/** One package in the composition stack (merge order; later layers win). */
export interface PackageLayerInfo {
  package: string;
  root: boolean;
  /** The construct census by AST field (terms, processes, …). */
  kinds: { field: string; constructs: number }[];
}

/** One overlay pair: a term marked `overlay true` in the merged model,
 *  joined to the nearest UPSTREAM definition it supersedes. The
 *  composition replaces the original (last-write-wins), so the upstream
 *  facets come from the upstream package's own load. `overlaidPackage`/
 *  `overlaid` are null when no upstream package declares the id — the
 *  marker then records intent and the composition needed no lift. */
export interface PackageOverlayInfo {
  id: string;
  /** The overlaying (winning) package + the package-relative file. */
  package: string;
  file: string;
  label?: string;
  definition?: string;
  source?: string;
  overlaidPackage: string | null;
  overlaid: { label?: string; definition?: string; source?: string } | null;
}

/** The dev server's answer to POST /api/package/open. */
export interface PackageOpenResult {
  dir: string;
  id: string;
  title: string;
  /** The parsed manifest. The canonical dump does not carry it (a known
   *  kernel dump gap); the payload ships it and the store re-attaches
   *  it to the AST so the manifest panels and the manifest-change
   *  detection keep working in package mode. */
  manifest: PackageManifest;
  composition: { root: string; order: string[] };
  /** Load-time advisories (e.g. provides-consumed-or-waived) — surfaced,
   *  never fatal. */
  issues: string[];
  files: PackageFileInfo[];
  imports: PackageImportInfo[];
  /** The composition stack (merge order — later layers win): every
   *  package's construct census by kind. The layer-overlay view's
   *  stack section. */
  layers: PackageLayerInfo[];
  /** The overlay pairs (terms marked `overlay true` + the upstream
   *  definitions they supersede). The layer-overlay view's table. */
  overlays: PackageOverlayInfo[];
  /** The canonical dump of the composed model — the AST source text. */
  dump: string;
  provenance: PackageProvenance;
}

/** One file write of a package save plan. */
export interface PackageFileWrite {
  path: string;
  text: string;
}

/** Probe the package API's availability (a static host 404s — the
 *  package chrome then stays hidden, mirroring the save probe). */
export async function packageApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/package', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Open a package directory (server-side provenance load). */
export async function openPackageDir(dir: string): Promise<PackageOpenResult> {
  const res = await fetch('/api/package/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return res.json() as Promise<PackageOpenResult>;
}

/** The save's commit record (G13 step 1): the substrate discipline —
 *  a save inside a repo IS a commit; outside one, the save says so. */
export interface PackageCommitResult {
  committed: boolean;
  oid: string | null;
  reason: string | null;
}

/** One entry of the workspace history — the repo's commit log. */
export interface PackageHistoryEntry {
  oid: string;
  message: string;
  timestamp: number;
  author: string;
}

/** Write a package save plan (per-file, .bak kept server-side) and
 *  commit it (best-effort — the write never waits on git). */
export async function writePackageFiles(dir: string, writes: PackageFileWrite[], message?: string): Promise<{ ok: boolean; files: { path: string; backup: boolean }[]; commit: PackageCommitResult }> {
  const res = await fetch('/api/package/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir, writes, message }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return res.json() as Promise<{ ok: boolean; files: { path: string; backup: boolean }[]; commit: PackageCommitResult }>;
}

/** The workspace history — the package repo's commit log, newest
 *  first (empty when the package lives outside a repository). */
export async function fetchPackageHistory(dir: string): Promise<PackageHistoryEntry[]> {
  const res = await fetch('/api/package/history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return ((await res.json()) as { history: PackageHistoryEntry[] }).history;
}

/** The dev server's answer to POST /api/package/check — the kernel's
 *  `primmel check` issue list. Known (allowlisted) issues arrive with
 *  `known: true`: they print, they never count. */
export interface PackageCheckResult {
  issues: CheckIssue[];
}

/** Run `primmel check` against the package as saved on disk. */
export async function checkPackageViaApi(dir: string): Promise<PackageCheckResult> {
  const res = await fetch('/api/package/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return res.json() as Promise<PackageCheckResult>;
}

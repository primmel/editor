// ─────────────────────────────────────────────────────────────────────
// The package bridge (TODO.editor wave 1) — the types and fetchers for
// the dev server's package API (vite.config.ts). Opening a v3 PACKAGE
// directory runs the kernel's provenance load server-side (the loader
// is fs-bound); the browser receives the merged dump (the AST source),
// the provenance map (construct → source file), and the root package's
// file inventory. Saving writes the per-file plan, never the merged
// dump.
// ─────────────────────────────────────────────────────────────────────

import type { PackageManifest, PackageProvenance } from '@primmel/primmel';

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

/** Write a package save plan (per-file, .bak kept server-side). */
export async function writePackageFiles(dir: string, writes: PackageFileWrite[]): Promise<{ ok: boolean; files: { path: string; backup: boolean }[] }> {
  const res = await fetch('/api/package/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir, writes }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? (await res.text()));
  return res.json() as Promise<{ ok: boolean; files: { path: string; backup: boolean }[] }>;
}

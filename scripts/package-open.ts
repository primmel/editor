// ─────────────────────────────────────────────────────────────────────
// The package-open payload builder (TODO.editor wave 1) — the server
// half of the package intake as a pure function: the vite middleware
// serves it, the unit tests and e2e legs prove it directly. Runs the
// kernel's provenance load (fs-bound), then shapes the payload: the
// root package's files WITH their authored bytes, the imported
// packages' structural footprint, the merged dump (the AST source),
// and the per-file provenance (the save's split map).
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { dump, loadPackageWithProvenance, packageFiles } from '@primmel/primmel';
import type { PackageOpenResult } from '../src/lib/package';
import { guardPackageDir } from './package-api-guard';

/** The `uses` resolver: a dependency is located by package id against
 *  the opened directory's SIBLINGS first, then the roots listed in the
 *  PRIMMEL_PACKAGE_ROOTS env (path-delimited). */
export function packageResolver(dir: string, rootsEnv: string | undefined): (id: string) => string | undefined {
  const roots = (rootsEnv ?? '').split(path.delimiter).filter(Boolean);
  return (id: string) => {
    for (const candidate of [path.join(path.dirname(dir), id), ...roots.map((r) => path.join(r, id))]) {
      if (fs.existsSync(path.join(candidate, 'package.primmel'))) return candidate;
    }
    return undefined;
  };
}

/** Open the package directory: the provenance load + the payload. */
export function openPackagePayload(dirArg: string, rootsEnv: string | undefined = process.env.PRIMMEL_PACKAGE_ROOTS): PackageOpenResult {
  const dir = guardPackageDir(dirArg);
  const resolvePackage = packageResolver(dir, rootsEnv);
  const result = loadPackageWithProvenance(dir, { resolvePackage });
  const manifest = result.standard.packageManifest;
  if (!manifest) throw new Error(`no package manifest parsed from ${dirArg}`);

  // The per-file construct census, straight from the provenance.
  const counts = new Map<string, number>();
  for (const ids of Object.values(result.provenance.constructs)) {
    for (const src of Object.values(ids)) {
      counts.set(src.file, (counts.get(src.file) ?? 0) + 1);
    }
  }

  const order = result.composition?.order ?? [manifest.id];
  const files = packageFiles(dir).map((f) => ({
    path: path.relative(dir, f.path),
    role: f.role,
    constructs: counts.get(f.path) ?? 0,
    text: fs.readFileSync(f.path, 'utf8'),
  }));
  const imports = order
    .filter((id) => id !== manifest.id)
    .map((id) => {
      const pkgDir = resolvePackage(id);
      if (!pkgDir) return { package: id, files: [] };
      const seen = new Map<string, number>();
      for (const [file, n] of counts) {
        if (file.startsWith(pkgDir + path.sep)) {
          const rel = path.relative(pkgDir, file);
          seen.set(rel, (seen.get(rel) ?? 0) + n);
        }
      }
      return {
        package: id,
        files: [...seen.entries()].map(([p, n]) => ({ path: p, constructs: n })),
      };
    });

  return {
    dir,
    id: manifest.id,
    title: manifest.title,
    manifest,
    composition: { root: manifest.id, order },
    issues: result.issues.map((i) => i.message),
    files,
    imports,
    dump: dump(result.standard),
    provenance: result.provenance,
  };
}

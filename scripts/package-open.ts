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
import { dump, loadPackage, loadPackageWithProvenance, packageFiles } from '@primmel/primmel';
import type { Standard } from '@primmel/primmel';
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

  // The composition stack (TODO.editor wave 5, the layer-overlay view):
  // every package's construct census by kind, straight from the
  // provenance — ConstructSource.package attests the authoring package
  // (the overlay winner, when one replaced an upstream term).
  const kindsByPackage = new Map<string, Map<string, number>>();
  for (const [field, ids] of Object.entries(result.provenance.constructs)) {
    for (const src of Object.values(ids)) {
      if (!src.package) continue; // absent only in manifest-less loads — the guard forecloses that here
      const byField = kindsByPackage.get(src.package) ?? new Map<string, number>();
      byField.set(field, (byField.get(field) ?? 0) + 1);
      kindsByPackage.set(src.package, byField);
    }
  }
  const layers = order.map((id) => ({
    package: id,
    root: id === manifest.id,
    kinds: [...(kindsByPackage.get(id) ?? new Map<string, number>()).entries()].map(([field, n]) => ({ field, constructs: n })),
  }));

  // The overlay pairs: every term marked `overlay true` in the merged
  // model, joined to the nearest UPSTREAM definition it supersedes. The
  // composition replaces the original (last-write-wins), so the upstream
  // facets come from the upstream package's own load (cached per dir).
  const upstreamCache = new Map<string, Standard>();
  const overlays = result.standard.terms
    .filter((t) => t.overlay === true)
    .map((t) => {
      const src = result.provenance.constructs.terms?.[t.id];
      const winnerPkg = src?.package ?? manifest.id;
      const winnerDir = winnerPkg === manifest.id ? dir : resolvePackage(winnerPkg);
      let overlaidPackage: string | null = null;
      let overlaid: { label?: string; definition?: string; source?: string } | null = null;
      for (let j = order.indexOf(winnerPkg) - 1; j >= 0; j--) {
        const upDir = order[j] === manifest.id ? dir : resolvePackage(order[j]);
        if (!upDir) continue;
        let upstream = upstreamCache.get(upDir);
        if (!upstream) {
          upstream = loadPackage(upDir, { resolvePackage });
          upstreamCache.set(upDir, upstream);
        }
        const hit = upstream.terms.find((u) => u.id === t.id);
        if (hit) {
          overlaidPackage = order[j];
          overlaid = { label: hit.label, definition: hit.definition, source: hit.source };
          break;
        }
      }
      return {
        id: t.id,
        package: winnerPkg,
        file: src && winnerDir ? path.relative(winnerDir, src.file) : '',
        label: t.label,
        definition: t.definition,
        source: t.source,
        overlaidPackage,
        overlaid,
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
    layers,
    overlays,
    dump: dump(result.standard),
    provenance: result.provenance,
  };
}

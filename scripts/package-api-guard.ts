// ─────────────────────────────────────────────────────────────────────
// The package-API guard (TODO.editor wave 1) — the middleware's path
// rules as pure functions (the config consumes them; the tests prove
// them):
//   - open: the directory must exist and carry a package.primmel
//     (the manifest's presence IS the scope rule — the API only ever
//     reads .prl/.primmel files under such a directory);
//   - save: every written file must stay INSIDE the opened package
//     directory and carry a .prl/.primmel extension — never an
//     escape, never a sibling package's file.
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

/** Resolve a package directory for opening, or throw why not. */
export function guardPackageDir(dir: string): string {
  if (typeof dir !== 'string' || dir.trim() === '') {
    throw new Error('the directory is empty');
  }
  const full = path.resolve(dir);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    throw new Error(`not a directory: ${dir}`);
  }
  if (!fs.existsSync(path.join(full, 'package.primmel'))) {
    throw new Error(`no package.primmel in ${dir} — not a Primmel package directory`);
  }
  return full;
}

/** Resolve a file to write INSIDE an opened package, or throw why not. */
export function guardPackageFile(packageDir: string, relPath: string): string {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error('the path is empty');
  }
  if (path.isAbsolute(relPath)) {
    throw new Error('absolute paths are refused (package-relative only)');
  }
  const full = path.resolve(packageDir, relPath);
  if (!full.startsWith(packageDir + path.sep)) {
    throw new Error('path escapes the package directory');
  }
  if (!/\.(prl|primmel)$/.test(full)) {
    throw new Error('only .prl/.primmel writes are accepted');
  }
  return full;
}

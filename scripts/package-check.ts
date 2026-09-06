// ─────────────────────────────────────────────────────────────────────
// The package-check payload builder (TODO.editor/05, slice 4) — the
// server half of the Check panel: `primmel check` is fs-bound (the
// package on disk is its subject), so the dev server runs it and ships
// the issue list to the browser, exactly like the open/save ops. The
// composition rules (C27–C31) get the same `uses` resolver as the
// open; checkPackage already folds in the manifest-resolution pass.
// ─────────────────────────────────────────────────────────────────────

import { checkPackage } from '@primmel/primmel/check';
import type { PackageCheckResult } from '../src/lib/package';
import { guardPackageDir } from './package-api-guard';
import { packageResolver } from './package-open';

/** Run `primmel check` against the package directory as saved on disk. */
export function checkPackagePayload(dirArg: string, rootsEnv: string | undefined = process.env.PRIMMEL_PACKAGE_ROOTS): PackageCheckResult {
  const dir = guardPackageDir(dirArg);
  const issues = checkPackage(dir, { resolvePackage: packageResolver(dir, rootsEnv) });
  return { issues };
}

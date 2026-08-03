// ─────────────────────────────────────────────────────────────────────
// The save-API guard (TODO.editor/35) — the middleware's path rule as
// a pure function (the config consumes it; the tests prove it):
// only .prl/.mmel under the project root, never an escape.
// ─────────────────────────────────────────────────────────────────────

import path from 'node:path';

/** Resolve a project-relative save path, or throw why not. */
export function guardSavePath(root: string, relPath: string): string {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error('the path is empty');
  }
  if (path.isAbsolute(relPath)) {
    throw new Error('absolute paths are refused (project-relative only)');
  }
  const full = path.resolve(root, relPath);
  if (!full.startsWith(root + path.sep)) {
    throw new Error('path escapes the project root');
  }
  if (!/\.(prl|mmel)$/.test(full)) {
    throw new Error('only .prl/.mmel writes are accepted');
  }
  return full;
}

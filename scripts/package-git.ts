// ─────────────────────────────────────────────────────────────────────
// The package git plane (G13 step 1 — the substrate decision): the
// package directory rides an ISOMORPHIC-GIT repository — every save is
// an add+commit ("Update by Primmel Studio", Paneron's discipline),
// the log IS the workspace history. Existing repos are reused, never
// initialized; a package outside a repo saves without a commit and
// says so. Best-effort by design: a git failure never fails the save.
// ─────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import * as git from 'isomorphic-git';

export interface GitCommitResult {
  committed: boolean;
  oid: string | null;
  reason: string | null;
}

export interface HistoryEntry {
  oid: string;
  message: string;
  timestamp: number;
  author: string;
}

export const SAVE_COMMIT_MESSAGE = 'Update by Primmel Studio';

/** The enclosing repository root for dir — walks up to .git; null when
 *  there is none (we never init). */
export function repoRootFor(dir: string): string | null {
  let cur = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

/** Commit the written files (repo-relative adds against the repo
 *  root). The author is the repo's own git identity when it declares
 *  one, the Studio's otherwise. */
export async function commitPackageWrites(
  dir: string,
  files: string[],
  message: string = SAVE_COMMIT_MESSAGE,
): Promise<GitCommitResult> {
  const root = repoRootFor(dir);
  if (!root) {
    return {
      committed: false,
      oid: null,
      reason: 'not a git repository — the files saved without a commit',
    };
  }
  try {
    for (const f of files) {
      await git.add({ fs, dir: root, filepath: path.relative(root, path.resolve(dir, f)) });
    }
    const name = (await git.getConfig({ fs, dir: root, path: 'user.name' })) || 'Primmel Studio';
    const email =
      (await git.getConfig({ fs, dir: root, path: 'user.email' })) || 'studio@primmel.local';
    const oid = await git.commit({ fs, dir: root, message, author: { name, email } });
    return { committed: true, oid, reason: null };
  } catch (e) {
    return { committed: false, oid: null, reason: (e as Error).message };
  }
}

/** The workspace history — the repo's commit log, newest first. */
export async function packageHistory(dir: string, depth = 30): Promise<HistoryEntry[]> {
  const root = repoRootFor(dir);
  if (!root) return [];
  const log = await git.log({ fs, dir: root, depth });
  return log.map((e) => ({
    oid: e.oid,
    message: e.commit.message.trim(),
    timestamp: e.commit.author.timestamp,
    author: e.commit.author.name,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// G13 step 1 — the substrate discipline holds: a save inside a repo is
// a commit (the log IS the history); a package outside a repo saves
// without a commit and says so; the repo is found by walking up, never
// initialized.
// ─────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as git from 'isomorphic-git';
import {
  commitPackageWrites,
  packageHistory,
  repoRootFor,
  SAVE_COMMIT_MESSAGE,
} from '../../../scripts/package-git';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'primmel-git-'));
}

it('reports, never throws, when the package is outside a repo', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.prl'), 'x');
  const r = await commitPackageWrites(dir, ['a.prl']);
  expect(r.committed).toBe(false);
  expect(r.reason).toMatch(/not a git repository/);
});

it('commits the save and the log IS the history', async () => {
  const dir = tmp();
  await git.init({ fs, dir });
  fs.writeFileSync(path.join(dir, 'model.prl'), 'root R\n');
  const r = await commitPackageWrites(dir, ['model.prl'], 'first save');
  expect(r.committed).toBe(true);
  expect(r.oid).toHaveLength(40);
  const h = await packageHistory(dir);
  expect(h[0]!.message).toBe('first save');
  expect(h[0]!.author).toBe('Primmel Studio');
});

it('walks up to the enclosing repo and defaults the message', async () => {
  const root = tmp();
  await git.init({ fs, dir: root });
  const sub = path.join(root, 'pkg');
  fs.mkdirSync(sub);
  expect(repoRootFor(sub)).toBe(root);
  fs.writeFileSync(path.join(sub, 'm.prl'), 'x');
  const r = await commitPackageWrites(sub, ['m.prl']);
  expect(r.committed).toBe(true);
  const h = await packageHistory(sub);
  expect(h[0]!.message).toBe(SAVE_COMMIT_MESSAGE);
});

it('history is empty outside a repo', async () => {
  expect(await packageHistory(tmp())).toEqual([]);
});

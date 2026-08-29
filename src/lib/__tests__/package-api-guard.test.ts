// ─────────────────────────────────────────────────────────────────────
// TODO.editor wave 1 — the package-API guard's refusals, proven.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { guardPackageDir, guardPackageFile } from '../../../scripts/package-api-guard';

const PKG = path.resolve(import.meta.dirname, 'fixtures/pkg-app');

describe('wave 1 — the package-API guard', () => {
  it('accepts a directory carrying package.primmel', () => {
    expect(guardPackageDir(PKG)).toBe(PKG);
  });

  it('refuses a missing directory and a directory without a manifest', () => {
    expect(() => guardPackageDir(path.join(PKG, 'no-such-dir'))).toThrow('not a directory');
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-guard-'));
    expect(() => guardPackageDir(bare)).toThrow('no package.primmel');
    fs.rmSync(bare, { recursive: true, force: true });
  });

  it('refuses an empty directory argument', () => {
    expect(() => guardPackageDir('')).toThrow('empty');
  });

  it('accepts a package-relative .prl/.primmel write inside the package', () => {
    expect(guardPackageFile(PKG, 'model/processes.prl')).toBe(path.join(PKG, 'model/processes.prl'));
    expect(guardPackageFile(PKG, 'package.primmel')).toBe(path.join(PKG, 'package.primmel'));
  });

  it('refuses escapes outside the package and absolute paths', () => {
    expect(() => guardPackageFile(PKG, '../pkg-lib/terminology.prl')).toThrow('escapes');
    expect(() => guardPackageFile(PKG, 'a/../../outside.prl')).toThrow('escapes');
    expect(() => guardPackageFile(PKG, '/etc/passwd')).toThrow('absolute');
  });

  it('refuses non-.prl/.primmel extensions and empty paths', () => {
    expect(() => guardPackageFile(PKG, 'evil.sh')).toThrow('only .prl/.primmel');
    expect(() => guardPackageFile(PKG, 'model.prl.bak')).toThrow('only .prl/.primmel');
    expect(() => guardPackageFile(PKG, '')).toThrow('empty');
  });
});

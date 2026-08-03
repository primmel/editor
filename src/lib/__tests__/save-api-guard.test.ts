// ─────────────────────────────────────────────────────────────────────
// TODO.editor/35 — the save-API guard's refusals, proven.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { guardSavePath } from '../../../scripts/save-api-guard';

const ROOT = '/project/root';

describe('35 — the save-API guard', () => {
  it('accepts a plain project-relative .prl/.mmel path', () => {
    expect(guardSavePath(ROOT, 'packages/acme/model.prl')).toBe('/project/root/packages/acme/model.prl');
    expect(guardSavePath(ROOT, 'demo/model.mmel')).toBe('/project/root/demo/model.mmel');
  });

  it('refuses escapes outside the project root', () => {
    expect(() => guardSavePath(ROOT, '../outside.prl')).toThrow('escapes');
    expect(() => guardSavePath(ROOT, 'a/../../outside.prl')).toThrow('escapes');
    expect(() => guardSavePath(ROOT, '/etc/passwd')).toThrow('absolute');
  });

  it('refuses non-.prl/.mmel extensions', () => {
    expect(() => guardSavePath(ROOT, 'evil.sh')).toThrow('only .prl/.mmel');
    expect(() => guardSavePath(ROOT, 'model.prl.bak')).toThrow('only .prl/.mmel');
    expect(() => guardSavePath(ROOT, 'model.prl/evil')).toThrow('only .prl/.mmel');
  });

  it('refuses an empty path', () => {
    expect(() => guardSavePath(ROOT, '')).toThrow('empty');
    expect(() => guardSavePath(ROOT, '   ')).toThrow('empty');
  });

  it('a .prl inside a nested dir resolves inside the root', () => {
    expect(guardSavePath(ROOT, 'primmel-packages/oiml-r60/model.prl'))
      .toBe('/project/root/primmel-packages/oiml-r60/model.prl');
  });
});

# 35 — The dependency + security audit

**Wave:** audit · **Depends on:** all · **Priority:** P0

## Goal

Zero high-severity advisories on the editor's dependency tree, and a
reviewed story for the kernel's (yarn-locked, no npm lockfile).

## Spec

- **Editor**: `npm audit` shows 2 high (brace-expansion DoS, js-yaml
  parsing DoS) — `npm audit fix` where it stays within semver;
  upgrade the parents directly where it doesn't (js-yaml ≥ 5.2.2 /
  the patched line). Re-audit to zero-high.
- **Kernel (primmel-ts)**: generate a temporary npm lockfile ONLY for
  the audit (never committed — the repo is yarn-locked), audit,
  upgrade what is honestly upgradable; record advisories that touch
  dev-only tooling with their justification.
- **The build-time surfaces**: the save middleware writes only
  .prl/.mmel under the project root with .bak — prove the refusal of
  `../` escapes and non-.prl extensions with unit tests against the
  middleware logic.
- **Dependabot note**: the GitHub-flagged advisories on the repos
  close (the fix commits referenced).

## Homes

1. `package.json` + `package-lock.json` (editor).
2. `scripts/__tests__/save-api.test.ts` (the middleware refusals).
3. The kernel's audit note in TODO.editor/AUDIT.md.

## Acceptance

- `npm audit` (editor): 0 high, 0 critical.
- The save-middleware refusals are tested (escape, wrong extension).
- Gates green.

# 33 — The typing-discipline audit (respond_to-class, any, imports) ✅ DONE (49195d9)

**Wave:** audit · **Depends on:** 32 · **Priority:** P1

## Goal

The Ruby-doctrine rules, translated honestly to TypeScript: no
encapsulation breaks (32), no `respond_to`-style duck typing for
control flow, no lazy `any`, and import discipline (module boundaries
only — the kernel's public API, never its internals).

## Spec

- **Duck-typing dispatch**: audit `typeof x ===`, `in` checks used as
  type dispatch, and `Array.isArray` abuse — each site either becomes
  a proper discriminated union / interface, or is justified as a
  genuine runtime boundary (JSON parse of untyped payloads — the
  save middleware, the file readers) with a narrowed type on entry.
- **`any` audit**: the remaining `: any` / `as any` (test files are
  free; src/ holds 1 + the e2e probes — the probes are strings, not
  shipped code, but the shipped src must be clean).
- **Import discipline**: no deep imports (`@primmel/primmel/dist/**`,
  relative paths into node_modules, imports reaching INTO another
  package's src). The linkedom test seam and the kernel's public
  index are the only cross-package doors.
- **The linter**: enable `@typescript-eslint/no-explicit-any` as a
  warning in a new minimal eslint config IF cheap; else encode the
  rules as a `scripts/audit-typing.mjs` gate wired into
  `npm run build` (grep-class check — honest and dependency-free).

## Homes

1. `scripts/audit-typing.mjs` (the grep-class gate) + build wiring.
2. The fixed sites.

## Acceptance

- `grep -rn ': any\b' src/` is empty outside tests/probes.
- The audit gate runs in the build and fails on regressions.
- Gates green.

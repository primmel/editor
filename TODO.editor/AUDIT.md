# The audit report — Primmel Studio (2026-08)

The audit wave (TODO.editor/32–36): the four constraint classes
audited across the whole codebase, what was found, what was fixed,
and the ongoing rules with their gates. This is the written record;
[VALIDATION.md](VALIDATION.md) is the capability contract's record.

## The four constraint classes — before/after

| Class | Before | After | The fix |
|---|---|---|---|
| **Encapsulation breaks** (`as never` / `as unknown` for kernel shapes — the private-send equivalent) | 26 casts across 9 files (commands.ts's structural mirror of the kernel's flow types + every site that cast through it) | **3 documented seams** (the dev-only window hooks ×2, the raw `_relations` parse lens) | The kernel exports the flow types + typed events upstream; the mirror deleted; before-captures use keyof-typed reads (patch keys ARE `keyof T`); placements/pages/profiles take real types; the DragEvent cast dropped (it IS a MouseEvent); the File System Access API gets a declared surface in `env.d.ts` |
| **Duck-typing dispatch** (typeof/in/instanceof as control flow — the respond_to equivalent) | 1 site | **1 justified site** | `simulator.ts`'s compare() is the genuine value-domain union (number | string | boolean from user-authored expressions) — documented; no other site exists |
| **Lazy `any`** (shipped src) | 1 (`window as any` for showOpenFilePicker) | **0** | declared interface in `env.d.ts` |
| **Import discipline** (deep imports, require-style loads) | 0 | **0** | was always clean; the gate keeps it |
| **Duplicate seam definitions** | `edgeEnds` ×2 (commands.ts + edges.ts) | **1 home** (edges.ts) | commands.ts imports it |

## Spec coverage (every lib module)

| Module | Tests | Module | Tests |
|---|---|---|---|
| commands | 16 | measurement | 4 |
| edges (incl. pages) | 22 | simulator | 9 |
| factory | 4 | comments | 3 |
| mapper | 4 | mmel-import + legacy-vocabulary + corpus-matrix | 18 |
| multi-map | 4 | monaco-prl | 4 |
| coverage | 5 | monaco-language | 3 |
| diff-view | 3 | save + save-api-guard | 10 |
| document-model | 6 | templates | 5 |
| automap | 6 | validation | 5 |
| pages | 12 | plugins (registry) | 4 |
| render | 9 | r7-tutorial | 6 |
| layout | 3 | docs-guide | 4 |
| model-store | 3 | data-editors | 7 |

28 test files, **169 tests** — render/layout/monaco-language were the
only untested modules before the audit; they are covered now.

## The performance evidence

- **The automap budget**: the O(m·n) edit distance now runs only for
  token-competitive candidates — a 262×56-process scan measures
  **~135ms** (was unbounded and could hang the tab).
- **The scale proof** (`e2e/scale-smoke.ts`, ISO27001: 262 processes,
  77 pages): load 3.0s (parse + first render) · viewport cull keeps
  rendered nodes bounded (8/8 on the root page) · page switch 0.4s ·
  mapper with 815 party rows at 2.5s · save-preview diff at 2.5s —
  no freeze, no reload artifact (probes pass corpus text from node —
  fetching fixtures through the dev server pulls them into vite's
  module graph and can reload the page mid-evaluate).

## The security table

| Advisory | Severity | Status |
|---|---|---|
| brace-expansion DoS (GHSA-mh99-v99m-4gvg) | high | fixed (`npm audit fix`) |
| js-yaml exponential parsing (GHSA-pm4m-ph32-ghv5) | high | fixed (`npm audit fix`) |
| editor tree | — | **0 vulnerabilities** |
| kernel tree (yarn-locked; audited via a temp lockfile, never committed) | — | **0 vulnerabilities** |
| save middleware | — | guard extracted (`scripts/save-api-guard.ts`), 5 refusal tests, live-verified (escape → 400, `.sh` → 400, valid → ok) |

## The ongoing rules (each with its gate)

1. **No `as never` / `as unknown` for kernel shapes** — the fix is
   always the type export upstream. (Gate: `scripts/audit-typing.mjs`
   R1, in `npm run build`.)
2. **No lazy `any`** — a boundary gets a declared interface.
   (Gate: R2.)
3. **No duck-typing dispatch** — discriminated unions; a genuine
   value domain documents itself. (Gate: R3.)
4. **Module boundaries only** — the kernel's public API; no deep
   imports, no require-style loads. (Gates: R4, R5.)
5. **One home per seam** — duplicates are deleted on sight.
   (Gate: R6, canary `edgeEnds`.)
6. **The viewport cull is the frame budget** — render work is bounded
   by what's visible; scorer work is budgeted by a cheap pre-score.
   (Gate: `e2e/scale-smoke.ts` in `e2e/run-all.sh`.)

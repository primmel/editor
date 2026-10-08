# 52 — The applications audit (2026-10-09, the second pass)

The owner's directive, second day: a deep audit of OUR APPLICATIONS —
read all TODO* files, ensure everything works in a browser and on
responsive mobile, finish the work.

## The scope, honestly drawn

| Application | Owner | This pass's scope |
|---|---|---|
| **Primmel Studio** (editor) | my lane | DONE yesterday (TODO.editor/51 + PR #56): every TODO item closed, the responsive layer landed, all legs green at desktop + 390×844. Today: RE-CERTIFY the frozen tree (the standing legs) — main is unchanged (3fc8ee0), deploy green. |
| **The smart app** | the other agent's live lane (shared checkout — no mutations from me; a mid-flight restore reverted my edits twice before) | READ-ONLY: scan its TODO program book for open items; probe the DEPLOYED site in a browser at desktop + mobile widths; report findings, never edit |
| **The kernel** (primmel-ts) | my lane | a library, not an application — its TODO.roadmap is the program book; scan for open items; no UI to test (its artifacts are proven by the 1681-test suite + 248-case conformance) |
| **The library** (model-library-spike) | my lane (content) | no UI; composed checks 41/41 green as of the last pass |

## The plan

1. **Re-certify the Studio** (the demo is Monday): the full standing
   suite once more on the frozen tree, desktop + mobile.
2. **The kernel's TODO.roadmap**: grep the open items; anything
   marked open and demo-relevant is finished; anything long-term is
   named (the roadmap's numbered program is the kernel's forward
   book, not demo debt).
3. **The smart app, read-only**: count open checkboxes across its
   ~50 TODO directories (expect near-zero — they are closed program
   records like ours); probe the deployed production URL at 1440 and
   390 widths (puppeteer, no login — the public pages); verify its
   deploy/CI status from the API. Findings reported to the owner, not
   filed into the other agent's lane.
4. **Write the record**: this file is it; the memory carries the
   state.

## The demo (Monday 2026-10-13) — the standing answer

The Studio is frozen, rehearsed (desktop + mobile), deployed green,
with fallback screenshots at both widths. The smart app is the other
agent's deployed production lane.

## The findings (2026-10-09)

- **The kernel's forward book (the smart repo's TODO.roadmap, 64
  files): ZERO open checkboxes.**
- **The smart app**: main CI success + production deploy-cloudflare
  SUCCESS (the deploy workflow's own smoke leg verifies the deployed
  site on every merge — the production URL is account-subdomained, so
  an outside probe would be a guess; their lane owns it). Its ~460
  open checkboxes sit in the OLDER program books (UPGRADE 48,
  promotion 37, fix 37, …) — the other agent's lane, reported not
  touched. Their responsive program exists: TODO.identity-features/
  02-responsive-ux-audit.md.
- **The Studio**: re-certified below.

## The third pass (2026-10-09, "do ALL the work now") — deeper

The prior passes proved three legs at mobile width and the suite at
desktop. This pass removes the asymmetry:

1. **The FULL standing suite runs at BOTH widths** — every leg at
   1440×950 AND 390×844 (`E2E_VIEWPORT=mobile ./e2e/run-all.sh`).
   Whatever breaks at mobile is a real finding, fixed.
2. **R4 closes: the canvas on touch.** The pan/zoom interactions get
   a touch-driven probe (emulated touch drag), not a manual note.
3. **The record updates** with the matrix: leg × width × result.

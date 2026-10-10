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

## The third pass's result (2026-10-09)

**The full standing suite runs GREEN AT BOTH WIDTHS:**
- desktop 1440×950: every leg OK (the serial re-certification)
- **mobile 390×844: 56/56 legs OK, exit 0** (`E2E_VIEWPORT=mobile
  ./e2e/run-all.sh` — all 55 legs take the viewport; the runner
  declares it)

What the mobile pass found and fixed:
1. **The canvas was inert on touch** — mouse-only handlers; converted
   to pointer events + `touch-action: none` (PR #58). The ordering
   trap (pointerup before mouseup broke the connect flow at desktop)
   caught by canvas-smoke, fixed symmetrically.
2. **Two probes spoke synthetic MouseEvents** for the shift-drag —
   synthetic mouse events don't synthesize pointers; both dispatch
   PointerEvents now (PR #59).
3. The runner's own quoting bug (exit 2 with all legs green) fixed.

`canvas-touch-smoke` is a standing leg. The studio now demonstrably
works on a phone: every surface, every leg, both widths.

## The fourth pass (2026-10-09) — the deployed artifact + NATIVE

1. **The deployed production build is now PROBED** (never before —
   every prior leg ran against the dev server):
   `e2e/deployed-smoke.ts` walks http://www.primmel.org/editor/ at
   both widths — the artifact mounts, the desktop grid intact, the
   CSS carries the media queries, and at 390×844 the DEPLOYED shell
   collapses with drawers and no horizontal overflow. DEPLOYED OK.
   (A production-monitor leg, not in run-all — the network does not
   belong in the local suite.)
2. **The native tap**: the dev server runs LAN-exposed
   (`npm run dev -- --host --port 5198`) at
   http://192.168.1.90:5198/ — a phone on the studio Wi-Fi opens the
   studio natively. The emulation has proven everything it can; the
   finger is the owner's (pan the canvas, open the drawers, run the
   twin).

## The fifth pass (2026-10-09) — the public family + honest limits

1. **The public sites probed** (new production-monitor leg
   `e2e/public-sites-smoke.ts`): primmel.org and oimlsmart.org at
   390×844 — both mount, contentful, no horizontal overflow.
   PUBLIC-SITES OK.
2. **No native device is attached** to this machine (no adb /
   devicectl devices) — the LAN tap (http://192.168.1.90:5198/)
   remains THE native path; the finger is the owner's.
3. **The smart app's deployed URL is not machine-discoverable**
   (deployment payloads carry no URL; it lives in their workflow
   config). Their own deploy smoke — green on every merge — owns that
   verification. We do not guess URLs.

## The sixth pass (2026-10-09) — the WebKit pass + the deferred wave

Every probe so far runs CHROMIUM; the phone's browser is WebKit
(iOS Safari). This pass:

1. **The WebKit leg** — playwright's webkit drives the responsive
   shell + the twin at 390×844 under the real mobile engine;
   whatever Safari-css breaks (`100vw` in calc, `position: fixed`
   drawers, backdrop) is fixed and pinned as a standing leg.
2. **G11's smallest honest increment** (the independent deferred
   wave): the `.sdc` clause-document parser (the format is spec'd:
   `namespace#/title#/version#/###/n#statement`) as a pure lib with
   specs, feeding the document plane.

## The eighth pass (2026-10-10) — the fixes proven in production

**DEPLOYED-BUGS OK**: yesterday's two fixes verified against the
PRODUCTION pages build, not just the dev server — the boot diagram
centers to 0.000005px and a jittering tap holds the node at the
identical pixel (`e2e/deployed-bugs-smoke.ts`, the production-monitor
family). The demo rehearsal re-walked on the final tree at BOTH
widths (zero page errors), screenshots refreshed; the full serial
desktop suite re-run on the frozen result.

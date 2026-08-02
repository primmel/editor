# 28 — The validation close-out (the capability contract, proven)

**Wave:** validation · **Depends on:** 21–27 · **Priority:** P0

## Goal

The written proof that the Studio achieves the full capability
contract — every user-facing promise validated live, in one document,
with the honest status of each leg and its proof command.

## Spec

- `TODO.editor/VALIDATION.md`: the capability matrix —
  | promise | the leg | the proof | status |
  — create new models (ref/imp) → 22 + 25 leg 1–2 · import old MMEL
  (all ten) → 21/24 matrix · mappings with coverage → 25 leg 6 ·
  navigate → 25 leg 4–5 · data registers → 23 + 25 leg 3 · processes
  + drill in/out → 25 leg 4 · diagrams → 25 leg 5 · run execution →
  25 leg 7 · new OIML Recommendation (R 7) → 26 + 27 tutorial.
- The close-out run: ALL gates in ALL repos in one sweep —
  editor (vue-tsc, vitest, build, 19-leg e2e), kernel (1078+ tests),
  the docs builds (smart architecture, primmel-smart-docs) — with the
  outputs quoted in VALIDATION.md.
- The honest "not yet" list: what the validation surfaced as
  genuinely out of scope (with reasons), never hidden.

## Homes

1. `TODO.editor/VALIDATION.md`.
2. The final commits across the repos (editor, kernel, smart,
   primmel-smart-docs).

## Acceptance

- VALIDATION.md exists with every leg's proof + output.
- The full sweep green at the commit referenced in the doc.
- All item files 21–28 carry their ✅ + commit ids.

# 29 — Validation throughout (the Primmel validation surface) ✅ DONE (9bea2b1)

**Wave:** validation · **Depends on:** 01, 15 · **Priority:** P0

## Goal

Validation is a visible surface at every stage, not a final check:
the live model shows its kernel-validation state continuously, the
import dialog validates and reports before the model swaps (MMEL in,
Primmel out — the output is validated Primmel v3), and the save
review carries the validation state into the commit decision.

## Spec

- **The Validation panel** (`components/ValidationPanel.vue`): the
  kernel's `validate()` on the live model, recomputed per version —
  severity chips (error/warning/info counts in the header), the issue
  list (code, construct, element id, message), click an issue to
  select the offending element. A right-panel tab beside Inspect /
  Compliance / Simulate. The topbar gains the validation badge
  (error count in red, warning in amber, clean in green).
- **The import dialog**: "Import MMEL → Primmel" — the report's
  validation section is mandatory and prominent; the confirm button
  says "import as Primmel (.prl)"; when validation issues exist they
  must be acknowledged (the button reads "import anyway (N issues)").
- **The save review**: the validation state line (clean / N issues)
  inside the save panel beside the diff counts.
- **Tests**: the panel's verdict computation (lib/validation.ts —
  pure: issues → counts + click targets); the capability walk (25)
  gains the validation leg: a broken model (duplicate id via text)
  flags in the panel; fixing clears it.

## Homes

1. `src/lib/validation.ts` + `src/lib/__tests__/validation.test.ts`.
2. `src/components/ValidationPanel.vue` + the topbar badge + the
  right-panel tab.
3. `src/components/ImportPanel.vue` + `SavePanel.vue` updates.

## Acceptance

- A clean model shows the green badge; a broken one flags with the
  kernel's own issue (code + message); clicking the issue selects the
  element; fixing clears it live.
- The import dialog always shows the validation section; the e2e leg
  proves the acknowledge path.
- Gates green.

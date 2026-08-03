# 39 — The OIML-CS corpus + the certification-workflow model

**Wave:** oiml-cs · **Depends on:** 38 · **Priority:** P0

## Goal

The OIML-CS deep audit's proof: the full CS document corpus parses
with real content; the oiml-cs scheme package (cs.prl's 34 PD-05
requirements) parses and doc-maps onto pd-05's statements; and the
OIML-CS certification workflow (application → acceptance → testing →
test report → evaluation report → certificate → BIML registration)
is a Studio model — built, validated, simulated.

## Spec

- **The corpus matrix extended**: the 13 CS documents through the
  mirror path with pinned clause/statement counts (test).
- **The scheme doc-map**: `demo/oiml-cs/` — a `map_profile
  "urn:oiml:pub:cs:pd-05:2024"` in a small scheme model that maps
  cs.prl's requirement kinds onto pd-05 statements (≥10 pairs,
  every target resolving against the parsed pd-05 mirror).
- **The 7-step certification model** (`demo/oiml-cs/certification.prl`):
  the OIML-CS chain as a simulatable process — roles (Applicant, IA,
  TL, BIML), the steps with their provisions (from cs.prl: application
  completeness/contents, fee + time estimates, sample count/rules,
  the test-report checklist, the certificate requirements, BIML
  registration), the gates (application complete? tests accepted?
  evaluation approved?), and the evidence flows (samples, TRs, ER,
  certificate).
- **The workflow simulates**: conforming application → certificate +
  BIML registration; incomplete application → the information-request
  path; a failed test → the no-certificate path.
- **The e2e leg** (`e2e/oiml-cs-smoke.ts`): the model opens (plugin
  activates), the workflow simulates to BIML registration, and the
  pd-05 doc-map shows mapped statements.

## Homes

1. `demo/oiml-cs/{README.md,model.prl,certification.prl}` (+ the
   pd-05 mirror fixture).
2. `src/lib/__tests__/oiml-cs.test.ts` + `e2e/oiml-cs-smoke.ts`.

## Acceptance

- 13/13 CS documents parse with real content (pinned).
- The oiml-cs package parses; the doc-map's targets resolve.
- The certification model validates and simulates all three paths;
  the e2e leg green.
- Gates green.

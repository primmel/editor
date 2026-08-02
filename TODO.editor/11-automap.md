# 11 — Automap: suggest, confirm, merge

**Wave:** mapping · **Depends on:** 08 · **Priority:** P1

## Goal

The MMEL extension's automapper: mapping SUGGESTIONS computed (never
asserted), a review list to confirm or reject, and merge into the
profile — including the kernel's closure proposals (all children
covered ⇒ parent proposal) flagged as proposals.

## Spec

- `src/lib/automap.ts`: the scorer — name similarity (normalized
  edit distance + token overlap), structural similarity (inputs/
  outputs overlap for processes, attribute overlap for dataclasses),
  and the closure rule (the calculus's own proposals) — each
  suggestion with its score and reason shown.
- `components/mapper/AutoMapPanel.vue`: the ranked suggestion list;
  confirm → `createMappingPair` (with the suggestion's reason as the
  draft description); reject → remembered for the session (never
  re-suggested).
- **Merge**: apply all confirmed suggestions into the active profile
  (mergeMapProfiles semantics — existing pairs never clobbered).
- **Honesty**: every auto-mapped pair carries
  `justification` seeded with "auto-suggested, confirmed by {user}" —
  the provenance of the claim is never hidden.

## Homes

1. `src/lib/automap.ts` (+ tests with the kernel's own sample models).
2. `src/components/mapper/AutoMapPanel.vue`.

## Acceptance

- The sample models: top-5 suggestions are correct matches (the
  fixtures pin them); confirm lands them in the profile with the
  provenance justification; rejected ones never reappear.
- A closure proposal (parent with all children mapped) appears as a
  PROPOSAL, clearly flagged.
- Gates green.

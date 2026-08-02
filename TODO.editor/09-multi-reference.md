# 09 — Multi-reference mapping: the lens

**Wave:** mapping · **Depends on:** 08 · **Priority:** P1

## Goal

Several REF models against one IMP (the integrated-management-system
story): a MapProfile per reference namespace, the switcher to "view
the IMS through ISO 9001" (or 27001, or any registered reference),
with coverage computed per profile.

## Spec

- `src/lib/multi-map.ts`: the profile registry — one IMP package's
  `mappings/` holds `mappings-{ns}.prl` per reference namespace; the
  switcher selects the active profile (canvas left side swaps the REF
  package, map edges + coverage recompute).
- **The lens**: the same IMP canvas, the REF side swapped — "view the
  implementation through standard X" (the multi-standard projection
  story: the auditor looks through ONE standard at a time).
- **Cross-profile invariants**: one IMP element may map into several
  profiles; the party list shows "mapped to 9001, 27001" badges per
  IMP element.
- **Merge/split**: a profile created from an existing one (the
  "start 27001 from the 9001 mappings" convenience — pairs carrying
  over with a review list, never silently).

## Homes

1. `src/lib/multi-map.ts` (+ profile registry in the store).
2. `src/components/mapper/ProfileSwitcher.vue` + the badges.
3. `src/lib/__tests__/multi-map.test.ts`.

## Acceptance

- One IMP mapped against two REF packages; the switch swaps REF +
  edges + coverage correctly; the per-element badges list both.
- A new profile seeded from an existing one shows the review list.
- Gates green.

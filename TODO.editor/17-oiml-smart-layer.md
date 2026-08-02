# 17 — The OIML SMART layer (the program plugin)

**Wave:** program · **Depends on:** 03, 04, 05, 07 · **Priority:** P1

## Goal

The first program layer, proving the plugin architecture: the OIML
SMART conveniences — the rec palettes (requirement, conformance
class, conformance test, form, instrument chain), the R 60
defining-data conveniences, and the certificate preview — all through
the plugin registry, never a program-id branch in the Studio kernel.

## Spec

- `src/plugins/`: the plugin contract — `StudioPlugin { id, palettes,
  inspectors, panels, actions }` registered at boot; the Studio's
  palette/inspector/panel slots consume the registry.
- `src/plugins/oiml/`: the OIML SMART plugin —
  - **Palettes**: requirement (with the provision link), conformance
    class + test (with result_forms), form reference, the instrument
    chain kinds (family/group/model/sample as data presets).
  - **Inspectors**: the requirement inspector (clause-URN source
    facet), the test inspector (steps/instances/result_forms), the
    defining-data shortcuts (the R 60 certificate fields).
  - **Panels**: the certificate preview (the current model's promise
    set rendered as the certificate characteristics, read-only).
- **The registry is the seam**: the Studio kernel exports
  `registerPlugin`; the app boots with the OIML plugin when opened on
  an OIML package — a second program (a later 〈scope〉 SMART) plugs
  the same way.

## Homes

1. `src/plugins/{index.ts,types.ts}` — the contract + registry.
2. `src/plugins/oiml/` — the palettes, inspectors, panels.
3. `src/lib/__tests__/plugin-registry.test.ts`.

## Acceptance

- Open the R 60 package: the OIML palettes/inspectors appear; the
  certificate preview renders the promise set.
- Open a non-OIML package (e.g. PAS2060): no OIML-specific UI leaks.
- The registry test: a third plugin registers without touching the
  kernel.
- Gates green.

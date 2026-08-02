# 13 — The process simulation

**Wave:** advanced · **Depends on:** 02, 05 · **Priority:** P2

## Goal

The MMEL extension's simulation: walk a process step by step with
its registers — state inspection per step, variable values editable
at each gate, the trajectory recorded.

## Spec

- `src/lib/simulator.ts`: the stepper — given a process (or
  subprocess page) + input variable values: walk steps (actions
  evaluate their writes into the register map; gates branch on their
  condition expressions over the registers; events mark entry/exit;
  subprocess descends). Pure, tested — the PRL process semantics per
  the kernel's own process executor where available.
- `components/simulation/SimulationPanel.vue`: the current step
  highlighted on the canvas, the register table (editable at gate
  stops), the trajectory log, step/continue/reset controls.
- **The honest wall**: simulation is a TEACHING surface — its
  register values never persist into the model (a run is ephemeral;
  "apply values" is an explicit opt-in to write initial values).

## Homes

1. `src/lib/simulator.ts` (+ trajectory tests).
2. `src/components/simulation/SimulationPanel.vue` + the canvas
   highlight.

## Acceptance

- Simulate the R 60 load_weight process with declared inputs: the
  trajectory matches the process's declared steps; a gate branches
  correctly on an edited register value.
- The canvas highlights each current step; reset restores the
  initial registers.
- Gates green.

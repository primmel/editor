# 36 — The audit close-out (AGENTS.md + AUDIT.md) ✅ DONE (4e1cf72)

**Wave:** audit · **Depends on:** 32–35 · **Priority:** P1

## Goal

The audit wave's written record and the agent entry-point: what was
audited, what was found, what was fixed, what stands as the ongoing
rule.

## Spec

- `TODO.editor/AUDIT.md`: the audit report — the four constraint
  classes (encapsulation breaks, duck-typing dispatch, lazy any,
  import discipline) with the before/after counts per class, the
  spec-coverage table (every lib module and its tests), the perf
  evidence (the scale smoke's numbers), the security table (the
  advisories and their fixes), and the ongoing rules (each a one-line
  law with its gate).
- `AGENTS.md` (this repo): the agent entry — the gates, the laws
  (the five from CLAUDE.md + the audit laws: no `as never` for kernel
  shapes, no duck-typing dispatch, no deep imports, the data
  discipline), the layout in one block, and the links into the user
  guide + CLAUDE.md.
- CLAUDE.md gains the audit laws (cross-referenced, not duplicated).

## Homes

1. `TODO.editor/AUDIT.md`, `AGENTS.md`, the CLAUDE.md addition.

## Acceptance

- AUDIT.md exists with the before/after evidence per constraint class.
- AGENTS.md exists and points correctly (the user asked for agents to
  know the repo fully — this closes it for the editor).
- Gates green.

// ─────────────────────────────────────────────────────────────────────
// The adopt cascade (G5 — the parity register): pull a reference
// element into the implementation (the term's wording, the
// requirement's whole shape — a full clone) AND create the map pair.
// The adoption and the pair are separate undo units (the command
// system's discipline); a colliding id refuses with a diagnostic,
// never silently overwrites.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Command } from './commands';
import { createMappingPair } from './commands';

function adoptFrom<T extends { id: string }>(
  pick: (m: Standard) => T[],
  imp: Standard,
  ref: Standard,
  refId: string,
): Command | null {
  const hit = pick(ref).find((e) => e.id === refId);
  if (!hit) return null;
  if (pick(imp).some((e) => e.id === refId)) {
    throw new Error(
      `${refId} already exists in the implementation — map it instead of adopting a copy`,
    );
  }
  const clone = structuredClone(hit);
  return {
    label: `adopt ${refId} from the reference`,
    apply(ast) {
      if (!pick(ast).some((e) => e.id === refId)) pick(ast).push(clone);
    },
    revert(ast) {
      const list = pick(ast);
      const idx = list.findIndex((e) => e.id === refId);
      if (idx >= 0) list.splice(idx, 1);
    },
  };
}

/** The adoption command: clone the reference element (a term, a
 *  requirement, or a process) into the implementation under its own
 *  id. */
export function adoptElement(imp: Standard, ref: Standard, refId: string): Command {
  const command =
    adoptFrom((m) => m.terms, imp, ref, refId) ??
    adoptFrom((m) => m.requirements ?? [], imp, ref, refId) ??
    adoptFrom((m) => m.processes, imp, ref, refId);
  if (!command) {
    throw new Error(
      `the reference declares no adoptable element ${refId} (terms, requirements, processes)`,
    );
  }
  return command;
}

/** The full cascade: the adoption command AND the map pair command
 *  (the adopted element maps to the reference element it came from). */
export function adoptWithPair(
  imp: Standard,
  ref: Standard,
  namespace: string,
  refId: string,
): { adoption: Command; pair: Command } {
  return {
    adoption: adoptElement(imp, ref, refId),
    pair: createMappingPair(namespace, refId, `${namespace}#${refId}`, {
      description: 'adopted from the reference (the cascade)',
      justification: 'adopt-from-reference: the element and its map arrive together',
    }),
  };
}

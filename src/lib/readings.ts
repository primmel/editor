// ─────────────────────────────────────────────────────────────────────
// The readings plane (the Paneron-parity pass): the model's dynamic
// state as ONE coherent readout — the measured variables, the
// calculated ones (DERIVED expressions and the TABLE lookups,
// evaluated by deriveComputed), and the GATE RAILS (each gateway's
// branches with the branch that would currently fire lit; the honest
// BLOCKED state when none does). Pure: the panel feeds it whichever
// registers the live engine (the twin or the simulation) holds.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { Subprocess } from './commands';
import { isTableVariable } from '@primmel/primmel';
import { edgeEnds } from './edges';
import { deriveComputed, evaluateCondition, simNodeKind } from './simulator';

export interface ReadingVariable {
  id: string;
  kind: 'measured' | 'derived' | 'table';
  /** The definition — an expression or a lookup spec ('' when none). */
  definition: string;
  description: string;
  /** The current value ('' when the registers carry none). */
  value: string;
  /** Why the value is absent/failed — the honest error, never a
   *  silent blank. */
  note: string | null;
}

export interface GateRailBranch {
  edgeId: string;
  condition: string;
  isDefault: boolean;
  /** The branch would currently be taken. */
  fires: boolean;
  /** The condition could not evaluate against the current registers. */
  unknown: boolean;
}

export interface GateRail {
  gatewayId: string;
  branches: GateRailBranch[];
  /** Exactly one branch fires, or a default exists, or BLOCKED. */
  state: 'routed' | 'default' | 'blocked';
}

export interface Readings {
  variables: ReadingVariable[];
  gates: GateRail[];
  /** Which engine the registers came from ('' = none running). */
  engine: string;
}

const GATEWAY_KINDS = new Set(['gateway-x', 'gateway-p']); // simNodeKind's vocabulary

export function readingsOf(
  model: Standard,
  registers: Record<string, string>,
  engine: string,
  measured: string[] = [],
): Readings {
  const { values, errors } = deriveComputed(model, registers, { measured });

  const variables: ReadingVariable[] = (model.variables ?? []).map((v) => {
    const kind: ReadingVariable['kind'] = v.type === 'DERIVED'
      ? 'derived'
      : isTableVariable(v) ? 'table' : 'measured';
    const computed = kind !== 'measured';
    return {
      id: v.id,
      kind,
      definition: v.definition,
      description: v.description,
      value: computed
        ? (values[v.id] !== undefined ? String(values[v.id]) : (registers[v.id] ?? ''))
        : (registers[v.id] ?? ''),
      note: computed && errors[v.id] ? errors[v.id] : null,
    };
  });

  const gates: GateRail[] = [];
  for (const page of model.pages ?? []) {
    for (const node of (page as Subprocess).childs ?? []) {
      const kind = simNodeKind(model, node.name);
      if (!kind || !GATEWAY_KINDS.has(kind)) continue;
      const branches: GateRailBranch[] = [];
      const edges = (page as Subprocess).edges ?? [];
      for (const e of edges) {
        const fromName = edgeEnds(e).from;
        if (fromName !== node.name) continue;
        const condition = (e.condition ?? '').trim();
        const isDefault = condition === '' || condition === 'default';
        let fires = false;
        let unknown = false;
        if (!isDefault) {
          try {
            fires = evaluateCondition(condition, { ...registers, ...stringifyValues(values) });
          } catch {
            unknown = true;
          }
        }
        branches.push({ edgeId: e.id, condition, isDefault, fires, unknown });
      }
      if (branches.length === 0) continue;
      const anyTrue = branches.some((b) => b.fires);
      const hasDefault = branches.some((b) => b.isDefault);
      gates.push({
        gatewayId: node.name,
        branches,
        state: anyTrue ? 'routed' : hasDefault ? 'default' : 'blocked',
      });
    }
  }

  return { variables, gates, engine };
}

function stringifyValues(values: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) out[k] = String(v);
  return out;
}



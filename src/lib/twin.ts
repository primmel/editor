// ─────────────────────────────────────────────────────────────────────
// The digital-twin tick pipeline (G14 — the parity register's stream
// mode): clock → source(time) → assignment → the model evaluates →
// surfaces. One tick: the clock advances dt; each stream source
// produces its reading; the readings assign into the registers; the
// model's computed registers derive (deriveComputed — the measurement
// semantics are the MODEL's, never reimplemented here); the surfaces
// read — the log grows, and the alert conditions evaluate over the
// registers with EDGE triggering (a condition fires when it goes
// false→true, like the legacy's alert edges).
//
// The twin is ephemeral (the simulator's honest wall): registers and
// log live in the twin store, never the model.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { deriveComputed, evaluateCondition } from './simulator';

/** One stream source: the measurement variable it feeds and the
 *  reading it produces at time t (seconds since the run started). The
 *  demo composes step functions over real corpus lookups — no
 *  synthetic physics. */
export interface StreamSource {
  variable: string;
  label: string;
  at(t: number): number;
}

export interface TickEvent {
  seq: number;
  t: number;
  readings: Record<string, number>;
  /** The derived values this tick (lookups and DERIVED expressions
   *  over the assigned registers). */
  values: Record<string, string | number>;
  /** The conditions that FIRED this tick (false→true edges). */
  alerts: string[];
}

export interface TwinRun {
  t: number;
  seq: number;
  registers: Record<string, string>;
  log: TickEvent[];
  /** The conditions currently firing (the edge detector's state). */
  alertsOn: Set<string>;
}

export function startTwin(
  registers: Record<string, string> = {},
): TwinRun {
  return { t: 0, seq: 0, registers: { ...registers }, log: [], alertsOn: new Set() };
}

/** The model's own alert surface — every gateway/edge condition,
 *  labeled by its edge. The model's logic IS the twin's invariants. */
export function modelAlertConditions(
  model: Standard,
): { label: string; condition: string }[] {
  const out: { label: string; condition: string }[] = [];
  for (const page of model.pages ?? []) {
    for (const e of (page as { edges?: { id: string; condition?: string }[] }).edges ?? []) {
      const c = (e.condition ?? '').trim();
      if (c !== '' && c !== 'default') {
        out.push({ label: `${page.id}:${e.id}`, condition: c });
      }
    }
  }
  return out;
}

/** One tick of the pipeline. dt in seconds (the legacy's clock tick —
 *  2s or 5s). */
export function tick(
  model: Standard,
  run: TwinRun,
  sources: StreamSource[],
  alertConditions: { label: string; condition: string }[],
  dt = 2,
): TwinRun {
  const t = run.t + dt;
  const readings: Record<string, number> = {};
  const registers = { ...run.registers };
  for (const s of sources) {
    const v = s.at(t);
    readings[s.variable] = v;
    registers[s.variable] = String(v);
  }
  const { values } = deriveComputed(model, registers);
  for (const [id, v] of Object.entries(values)) registers[id] = String(v);

  // The alert edges: a condition fires when it turns true and was not
  // already firing. A condition that cannot evaluate stays un-firing
  // (the registers may not carry its operands — no crash, no fire).
  const alerts: string[] = [];
  const alertsOn = new Set(run.alertsOn);
  for (const a of alertConditions) {
    let fires = false;
    try {
      fires = evaluateCondition(a.condition, registers);
    } catch {
      fires = false;
    }
    if (fires && !alertsOn.has(a.label)) alerts.push(a.label);
    if (fires) alertsOn.add(a.label);
    else alertsOn.delete(a.label);
  }

  return {
    t,
    seq: run.seq + 1,
    registers,
    alertsOn,
    log: [
      ...run.log,
      { seq: run.seq + 1, t, readings, values, alerts },
    ],
  };
}

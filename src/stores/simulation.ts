// ─────────────────────────────────────────────────────────────────────
// The simulation store (TODO.editor/13) — the ephemeral run: the
// stepper's state, the register edits, and the honest wall (a run
// never writes the model).
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { Standard } from '@primmel/primmel';
import { createRun, deriveComputed, resetRun, step, type SimState } from '../lib/simulator';

export const useSimStore = defineStore('simulation', () => {
  const run = shallowRef<SimState | null>(null);
  const active = computed(() => run.value !== null);

  function start(model: Standard) {
    run.value = createRun(model);
  }

  function stepOnce(model: Standard) {
    if (run.value) run.value = step(model, run.value);
  }

  /** Walk until done or blocked (capped — a looped model must not
   *  hang the panel). */
  function continueRun(model: Standard, cap = 200) {
    let n = 0;
    while (run.value && !run.value.done && !run.value.blocked && n < cap) {
      run.value = step(model, run.value);
      n++;
    }
  }

  function reset(model: Standard, keepRegisters = true) {
    run.value = resetRun(model, {
      keepRegisters: keepRegisters ? run.value?.registers : undefined,
    });
  }

  function stop() {
    run.value = null;
  }

  /** The computed registers derive (G16): DERIVED definitions and the
   *  TABLE family evaluate over the current registers; values merge in
   *  as strings, failures report per variable (never thrown). */
  function derive(model: Standard) {
    if (!run.value) return;
    const { values, errors } = deriveComputed(model, run.value.registers);
    const registers = { ...run.value.registers };
    for (const [id, v] of Object.entries(values)) registers[id] = String(v);
    run.value = { ...run.value, registers, deriveErrors: errors };
  }

  /** A register edit clears the blocked state (the gate re-evaluates
   *  on the next step). */
  function setRegister(id: string, value: string) {
    if (!run.value) return;
    run.value = {
      ...run.value,
      registers: { ...run.value.registers, [id]: value },
      blocked: null,
    };
  }

  return { run, active, start, stepOnce, continueRun, reset, stop, setRegister, derive };
});

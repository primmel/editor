// ─────────────────────────────────────────────────────────────────────
// The simulation store (TODO.editor/13) — the ephemeral run: the
// stepper's state, the register edits, and the honest wall (a run
// never writes the model).
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { Standard } from '@primmel/primmel';
import { createRun, resetRun, step, type SimState } from '../lib/simulator';

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

  return { run, active, start, stepOnce, continueRun, reset, stop, setRegister };
});

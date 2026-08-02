// ─────────────────────────────────────────────────────────────────────
// The measurement store (TODO.editor/16) — the run values per
// (process, measurement point). EPHEMERAL — evidence-adjacent, never
// model content.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MeasurementValue } from '../lib/measurement';

export const useMeasurementStore = defineStore('measurement', () => {
  /** processId → measureId → the run's value. */
  const values = ref<Record<string, Record<string, MeasurementValue>>>({});

  function set(processId: string, measureId: string, patch: Partial<MeasurementValue>) {
    const proc = values.value[processId] ?? {};
    const cur = proc[measureId] ?? { value: '', unit: '', uncertainty: '' };
    values.value = {
      ...values.value,
      [processId]: { ...proc, [measureId]: { ...cur, ...patch } },
    };
  }

  function get(processId: string, measureId: string): MeasurementValue {
    return values.value[processId]?.[measureId] ?? { value: '', unit: '', uncertainty: '' };
  }

  function clear() {
    values.value = {};
  }

  return { values, set, get, clear };
});

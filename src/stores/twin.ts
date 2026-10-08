// ─────────────────────────────────────────────────────────────────────
// The twin store (G14) — the tick pipeline's ephemeral run: the
// interval drives the clock, the sources feed the registers, the log
// grows. Never the model.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { Standard } from '@primmel/primmel';
import { startTwin, tick, type StreamSource, type TwinRun } from '../lib/twin';

export interface StepSourceConfig {
  /** The measured variable the stream feeds. */
  variable: string;
  /** The value before `switchAt`, after it. */
  from: number;
  to: number;
  switchAt: number;
}

export const useTwinStore = defineStore('twin', () => {
  const run = shallowRef<TwinRun | null>(null);
  const active = computed(() => run.value !== null);

  let timer: ReturnType<typeof setInterval> | null = null;
  let model: Standard | null = null;
  let sources: StreamSource[] = [];
  let conditions: { label: string; condition: string }[] = [];
  let dt = 2;

  function stepOnce() {
    if (!run.value || !model) return;
    run.value = tick(model, run.value, sources, conditions, dt);
  }

  function start(
    m: Standard,
    opts: {
      steps: StepSourceConfig[];
      conditions: { label: string; condition: string }[];
      dt?: number;
      registers?: Record<string, string>;
    },
  ) {
    stop();
    model = m;
    dt = opts.dt ?? 2;
    conditions = opts.conditions;
    sources = opts.steps.map((s) => ({
      variable: s.variable,
      label: `${s.variable} (the stream)`,
      at: (t: number) => (t <= s.switchAt ? s.from : s.to),
    }));
    run.value = startTwin(opts.registers ?? {});
    timer = setInterval(stepOnce, dt * 1000);
    stepOnce();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    run.value = null;
    model = null;
    sources = [];
    conditions = [];
  }

  return { run, active, start, stepOnce, stop };
});

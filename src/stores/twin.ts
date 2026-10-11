// ─────────────────────────────────────────────────────────────────────
// The twin store (G14) — the tick pipeline's ephemeral run: the
// interval drives the clock, the sources feed the registers, the log
// grows. Never the model. The sources are EITHER the authored step
// functions OR the measurement API (M-API): the async fetch is
// quarantined in lib/api-source; here it only decides what this
// tick's sources are.
// ─────────────────────────────────────────────────────────────────────
import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { Standard } from '@primmel/primmel';
import { startTwin, tick, type StreamSource, type TwinRun } from '../lib/twin';
import { fetchReadings, snapshotSources, type ApiMapping } from '../lib/api-source';

export interface StepSourceConfig {
  /** The measured variable the stream feeds. */
  variable: string;
  /** The value before `switchAt`, after it. */
  from: number;
  to: number;
  switchAt: number;
}

export interface ApiStatus {
  state: 'idle' | 'ok' | 'error';
  error?: string;
  /** The ms timestamp of the last successful fetch. */
  lastAt?: number;
}

export const useTwinStore = defineStore('twin', () => {
  const run = shallowRef<TwinRun | null>(null);
  const active = computed(() => run.value !== null);
  const apiStatus = shallowRef<ApiStatus>({ state: 'idle' });

  /** The ids that streamed on the LAST tick — the measured
   *  contract's ground truth (the readings panel forwards them so
   *  the derive never clobbers a measurement with the model's own
   *  lookup for the same id). */
  const streamedVariables = shallowRef<string[]>([]);

  let timer: ReturnType<typeof setInterval> | null = null;
  let model: Standard | null = null;
  let sources: StreamSource[] = [];
  let conditions: { label: string; condition: string }[] = [];
  let dt = 2;
  let api: { url: string; mappings: ApiMapping[] } | null = null;
  let fetching = false;

  async function stepOnce() {
    if (!run.value || !model || fetching) return;
    if (!api) {
      run.value = tick(model, run.value, sources, conditions, dt);
      streamedVariables.value = sources.map((s) => s.variable);
      return;
    }
    // The API tick: fetch, then the snapshot IS the tick's sources.
    // A failed fetch skips the readings this round (the registers
    // hold their last values, the semantics still evaluate) and the
    // wall says so.
    fetching = true;
    try {
      const outcome = await fetchReadings(api.url, api.mappings);
      if (!run.value) return;
      if (outcome.ok) {
        const paths: Record<string, string> = {};
        for (const m of api.mappings) paths[m.variable] = m.path;
        sources = snapshotSources(outcome.readings, paths);
        apiStatus.value = { state: 'ok', lastAt: Date.now() };
      } else {
        sources = [];
        apiStatus.value = { state: 'error', error: outcome.error };
      }
      run.value = tick(model, run.value, sources, conditions, dt);
      streamedVariables.value = sources.map((s) => s.variable);
    } finally {
      fetching = false;
    }
  }

  function start(
    m: Standard,
    opts: {
      steps: StepSourceConfig[];
      conditions: { label: string; condition: string }[];
      dt?: number;
      registers?: Record<string, string>;
      api?: { url: string; mappings: ApiMapping[] };
    },
  ) {
    stop();
    model = m;
    dt = opts.dt ?? 2;
    conditions = opts.conditions;
    api = opts.api ?? null;
    apiStatus.value = { state: api ? 'ok' : 'idle' };
    if (api) {
      sources = [];
    } else {
      sources = opts.steps.map((s) => ({
        variable: s.variable,
        label: `${s.variable} (the stream)`,
        at: (t: number) => (t <= s.switchAt ? s.from : s.to),
      }));
    }
    run.value = startTwin(opts.registers ?? {});
    streamedVariables.value = [];
    timer = setInterval(() => void stepOnce(), dt * 1000);
    void stepOnce();
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
    api = null;
    apiStatus.value = { state: 'idle' };
    streamedVariables.value = [];
  }

  return { run, active, apiStatus, streamedVariables, start, stepOnce, stop };
});

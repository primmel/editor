<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The twin panel (G14 + M-API) — the digital twin's surface: a stream
// source feeds the registers, the model's own conditions watch as
// alerts, the tick log grows. The source is either the authored step
// or a MEASUREMENT API — live JSON readings fetched each tick (the
// legacy extension's dynamic measurements via API).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useTwinStore, type StepSourceConfig } from '../../stores/twin';
import { modelAlertConditions } from '../../lib/twin';
import type { ApiMapping } from '../../lib/api-source';

const props = defineProps<{ model: Standard }>();
const twin = useTwinStore();

const mode = ref<'step' | 'api'>('step');
const variable = ref('');
const from = ref('1');
const to = ref('1.5');
const switchAt = ref('10');
const dt = ref('2');
/** The workspace's seed data: `k=v` pairs, comma-separated (the
 *  instance datum the lookups read — e.g. `class=1`). */
const seeds = ref('');
const apiUrl = ref('/api/measurements');
const mappings = ref<ApiMapping[]>([]);

const variables = computed(() => (props.model.variables ?? []).map((v) => v.id));
const conditions = computed(() => modelAlertConditions(props.model));
const firing = computed(() => (twin.run ? [...twin.run.alertsOn] : []));

function addMapping() {
  const v = variable.value || variables.value[0];
  if (!v) return;
  mappings.value = [...mappings.value, { variable: v, path: '' }];
}

function removeMapping(i: number) {
  mappings.value = mappings.value.filter((_, idx) => idx !== i);
}

function start() {
  const registers: Record<string, string> = {};
  for (const pair of seeds.value.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined && k.trim() !== '') registers[k.trim()] = v.trim();
  }
  let api =
    mode.value === 'api'
      ? { url: apiUrl.value.trim(), mappings: mappings.value.filter((m) => m.variable !== '') }
      : undefined;
  if (api) {
    if (!api.url) return;
    if (api.mappings.length === 0) {
      const v = variable.value || variables.value[0];
      if (!v) return;
      api = { ...api, mappings: [{ variable: v, path: '' }] };
    }
  }
  const step: StepSourceConfig = {
    variable: variable.value || variables.value[0] || 'area',
    from: Number(from.value),
    to: Number(to.value),
    switchAt: Number(switchAt.value),
  };
  twin.start(props.model, {
    steps: [step],
    conditions: conditions.value,
    dt: Number(dt.value) || 2,
    registers,
    api,
  });
}

const statusText = computed(() => {
  const s = twin.apiStatus;
  if (s.state === 'error') return `⚠ ${s.error} — the last registers stand`;
  if (s.state === 'ok' && s.lastAt) return `● streaming`;
  if (s.state === 'ok') return '● connected';
  return '';
});
</script>

<template>
  <div class="twin-panel" data-testid="twin-panel">
    <template v-if="!twin.run">
      <div class="twin-idle">
        <p>The digital twin: a measurement stream feeds the registers; the model's own semantics evaluate every tick.</p>
        <div class="twin-modes" role="group" aria-label="Stream source">
          <button type="button" :class="['twin-mode', { on: mode === 'step' }]" data-testid="twin-mode-step" @click="mode = 'step'">step stream</button>
          <button type="button" :class="['twin-mode', { on: mode === 'api' }]" data-testid="twin-mode-api" @click="mode = 'api'">measurement API</button>
        </div>
        <div class="twin-config">
          <template v-if="mode === 'step'">
            <label>stream variable
              <select v-model="variable" data-testid="twin-variable">
                <option value="" disabled>choose…</option>
                <option v-for="v in variables" :key="v" :value="v">{{ v }}</option>
              </select>
            </label>
            <label>from <input v-model="from" data-testid="twin-from" /></label>
            <label>to <input v-model="to" data-testid="twin-to" /></label>
            <label>switch at t <input v-model="switchAt" data-testid="twin-switch" /></label>
          </template>
          <template v-else>
            <label class="twin-api-url">endpoint <input v-model="apiUrl" data-testid="twin-api-url" class="mono" placeholder="https://instrument/api/readings" /></label>
            <div class="twin-mappings" data-testid="twin-mappings">
              <div v-for="(m, i) in mappings" :key="i" class="twin-mapping">
                <select v-model="m.variable" :data-testid="`twin-api-var-${i}`" aria-label="Measured variable">
                  <option v-for="v in variables" :key="v" :value="v">{{ v }}</option>
                </select>
                <span class="arrow">←</span>
                <input v-model="m.path" :data-testid="`twin-api-path-${i}`" placeholder="JSON path (empty = the variable's own key)" aria-label="JSON path" />
                <button type="button" class="twin-btn" :data-testid="`twin-api-remove-${i}`" aria-label="Remove mapping" @click="removeMapping(i)">×</button>
              </div>
              <button type="button" class="twin-btn" data-testid="twin-api-add" @click="addMapping">+ add mapping</button>
            </div>
          </template>
          <label>tick (s) <input v-model="dt" data-testid="twin-dt" /></label>
          <label>seed registers <input v-model="seeds" data-testid="twin-seeds" placeholder="class=1" /></label>
        </div>
        <button type="button" class="twin-btn primary" data-testid="twin-start" @click="start">start the twin</button>
        <p class="twin-wall">{{ conditions.length }} model conditions watch as alerts. A run is ephemeral — nothing writes the model.</p>
      </div>
    </template>

    <template v-else>
      <div class="twin-status">
        <span class="twin-clock" data-testid="twin-clock">t = {{ twin.run.t }}s</span>
        <span v-if="statusText" :class="['twin-api-status', { err: twin.apiStatus.state === 'error' }]" data-testid="twin-api-status">{{ statusText }}</span>
        <span v-for="f in firing" :key="f" class="twin-alert" :data-testid="`twin-firing-${f}`">▲ {{ f }}</span>
      </div>
      <div class="twin-controls">
        <button type="button" class="twin-btn" data-testid="twin-step" @click="twin.stepOnce()">tick</button>
        <button type="button" class="twin-btn danger" data-testid="twin-stop" @click="twin.stop()">stop</button>
      </div>
      <div class="twin-registers">
        <div class="twin-label">registers</div>
        <div v-for="(v, k) in twin.run.registers" :key="k" class="twin-register">
          <code>{{ k }}</code>
          <span :data-testid="`twin-reg-${k}`">{{ v }}</span>
        </div>
      </div>
      <div class="twin-log">
        <div class="twin-label">the stream ({{ twin.run.log.length }} ticks)</div>
        <div v-for="e in [...twin.run.log].reverse().slice(0, 40)" :key="e.seq" class="twin-tick" :data-testid="`twin-tick-${e.seq}`">
          <span class="twin-tick-seq">{{ e.seq }}</span>
          <span class="twin-tick-t">t={{ e.t }}</span>
          <span class="twin-tick-readings">{{ Object.entries(e.readings).map(([k, v]) => `${k}=${v}`).join(' ') }}</span>
          <span v-if="e.alerts.length" class="twin-tick-alert">▲ {{ e.alerts.join(' ') }}</span>
        </div>
      </div>
      <p class="twin-wall">A run is ephemeral — nothing writes the model.</p>
    </template>
  </div>
</template>

<style scoped>
.twin-panel { padding: 0.6rem; font-size: 0.78rem; }
.twin-modes { display: flex; gap: 0; margin: 0.5rem 0 0.4rem; }
.twin-mode { cursor: pointer; font-size: 0.66rem; padding: 0.2rem 0.55rem; background: transparent; border: 1px solid rgba(128,128,128,0.4); color: inherit; }
.twin-mode:first-child { border-radius: 4px 0 0 4px; }
.twin-mode:last-child { border-radius: 0 4px 4px 0; border-left: none; }
.twin-mode.on { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.6); font-weight: 700; }
.twin-config { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; align-items: flex-end; }
.twin-config label { display: flex; flex-direction: column; font-size: 0.66rem; gap: 0.15rem; }
.twin-config input, .twin-config select { width: 5.5rem; }
.twin-config label.twin-api-url { flex: 1 1 100%; }
.twin-config label.twin-api-url input { width: 100%; }
.mono { font-family: monospace; font-size: 0.7rem; }
.twin-mappings { display: flex; flex-direction: column; gap: 0.25rem; flex: 1 1 100%; }
.twin-mapping { display: flex; align-items: center; gap: 0.3rem; }
.twin-mapping select { width: 7rem; }
.twin-mapping input { flex: 1; font-family: monospace; font-size: 0.7rem; }
.twin-mapping .arrow { opacity: 0.6; }
.twin-btn { cursor: pointer; }
.twin-wall { font-size: 0.66rem; opacity: 0.6; }
.twin-status { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; }
.twin-clock { font-family: monospace; font-weight: 700; }
.twin-api-status { font-size: 0.68rem; color: #15803d; }
.twin-api-status.err { color: #b45309; }
.twin-alert { color: #b45309; font-size: 0.7rem; }
.twin-controls { display: flex; gap: 0.4rem; margin-bottom: 0.5rem; }
.twin-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; margin-bottom: 0.2rem; }
.twin-register { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.1rem 0; border-bottom: 1px dotted rgba(128,128,128,0.25); }
.twin-register code { font-size: 0.68rem; }
.twin-log { margin-top: 0.6rem; max-height: 14rem; overflow-y: auto; }
.twin-tick { display: flex; gap: 0.5rem; font-size: 0.66rem; padding: 0.08rem 0; }
.twin-tick-seq { opacity: 0.5; min-width: 1.4rem; text-align: right; }
.twin-tick-alert { color: #b45309; font-weight: 700; }
</style>

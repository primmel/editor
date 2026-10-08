<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The twin panel (G14) — the digital twin's surface: a stream source
// (the measured variable, the regime step), the model's own conditions
// as the alert surface, the tick log. The clock ticks dt seconds per
// step; the measurement semantics are the MODEL's.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useTwinStore, type StepSourceConfig } from '../../stores/twin';
import { modelAlertConditions } from '../../lib/twin';

const props = defineProps<{ model: Standard }>();
const twin = useTwinStore();

const variable = ref('');
const from = ref('1');
const to = ref('1.5');
const switchAt = ref('10');
const dt = ref('2');
/** The workspace's seed data: `k=v` pairs, comma-separated (the
 *  instance datum the lookups read — e.g. `class=1`). */
const seeds = ref('');

const variables = computed(() => (props.model.variables ?? []).map((v) => v.id));
const conditions = computed(() => modelAlertConditions(props.model));

const firing = computed(() => (twin.run ? [...twin.run.alertsOn] : []));

function start() {
  const step: StepSourceConfig = {
    variable: variable.value || variables.value[0] || 'area',
    from: Number(from.value),
    to: Number(to.value),
    switchAt: Number(switchAt.value),
  };
  const registers: Record<string, string> = {};
  for (const pair of seeds.value.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined && k.trim() !== '') registers[k.trim()] = v.trim();
  }
  twin.start(props.model, {
    steps: [step],
    conditions: conditions.value,
    dt: Number(dt.value) || 2,
    registers,
  });
}
</script>

<template>
  <div class="twin-panel" data-testid="twin-panel">
    <template v-if="!twin.run">
      <div class="twin-idle">
        <p>The digital twin: a measurement stream feeds the registers; the model's own semantics evaluate every tick.</p>
        <div class="twin-config">
          <label>stream variable
            <select v-model="variable" data-testid="twin-variable">
              <option value="" disabled>choose…</option>
              <option v-for="v in variables" :key="v" :value="v">{{ v }}</option>
            </select>
          </label>
          <label>from <input v-model="from" data-testid="twin-from" /></label>
          <label>to <input v-model="to" data-testid="twin-to" /></label>
          <label>switch at t <input v-model="switchAt" data-testid="twin-switch" /></label>
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
.twin-config { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
.twin-config label { display: flex; flex-direction: column; font-size: 0.66rem; gap: 0.15rem; }
.twin-config input, .twin-config select { width: 5.5rem; }
.twin-btn { cursor: pointer; }
.twin-wall { font-size: 0.66rem; opacity: 0.6; }
.twin-status { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
.twin-clock { font-family: monospace; font-weight: 700; }
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

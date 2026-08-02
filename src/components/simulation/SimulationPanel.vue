<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The simulation panel (TODO.editor/13) — the run controls, the
// register table (editable at gate stops), and the trajectory log.
// The honest wall is stated on the panel: register values never
// persist into the model.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useModelStore } from '../../stores/model';
import { useSimStore } from '../../stores/simulation';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const sim = useSimStore();

const run = computed(() => sim.run);

const registerIds = computed(() => (run.value ? Object.keys(run.value.registers).sort() : []));

function onRegisterInput(id: string, e: Event) {
  sim.setRegister(id, (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="sim-panel" data-testid="sim-panel">
    <template v-if="!run">
      <div class="sim-idle">
        <p>Walk the process step by step with its registers.</p>
        <button type="button" class="sim-btn primary" data-testid="sim-start" @click="sim.start(props.model)">
          start simulation
        </button>
        <p class="sim-wall">A run is ephemeral — register values never persist into the model.</p>
      </div>
    </template>

    <template v-else>
      <div class="sim-status">
        <span v-if="run.done" class="sim-badge done" data-testid="sim-done">completed</span>
        <span v-else-if="run.blocked" class="sim-badge blocked" data-testid="sim-blocked">{{ run.blocked }}</span>
        <span v-else class="sim-badge running">
          at <code data-testid="sim-current">{{ run.current?.nodeId }}</code>
        </span>
      </div>

      <div class="sim-controls">
        <button
          type="button"
          class="sim-btn"
          :disabled="run.done"
          data-testid="sim-step"
          @click="sim.stepOnce(props.model)"
        >step</button>
        <button
          type="button"
          class="sim-btn"
          :disabled="run.done"
          data-testid="sim-continue"
          @click="sim.continueRun(props.model)"
        >continue</button>
        <button
          type="button"
          class="sim-btn"
          data-testid="sim-reset"
          @click="sim.reset(props.model)"
        >reset</button>
        <button
          type="button"
          class="sim-btn danger"
          data-testid="sim-stop"
          @click="sim.stop()"
        >stop</button>
      </div>

      <div class="sim-registers">
        <div class="sim-section-label">registers</div>
        <div v-if="!registerIds.length" class="sim-empty">no variables declared</div>
        <div v-for="id in registerIds" :key="id" class="register-row">
          <code class="register-id">{{ id }}</code>
          <input
            class="register-input"
            :value="run.registers[id]"
            :data-testid="`register-${id}`"
            @change="onRegisterInput(id, $event)"
          />
        </div>
      </div>

      <div class="sim-trajectory">
        <div class="sim-section-label">trajectory ({{ run.trajectory.length }})</div>
        <div
          v-for="t in run.trajectory"
          :key="t.seq"
          class="trajectory-row"
          :class="{ current: run.current?.nodeId === t.nodeId && t.seq === run.trajectory.length }"
          :data-testid="`trajectory-${t.seq}`"
        >
          <span class="trajectory-seq">{{ t.seq }}</span>
          <span class="trajectory-node">{{ t.nodeId }}</span>
          <span class="trajectory-kind">{{ t.kind }}</span>
          <span v-if="t.note" class="trajectory-note">{{ t.note }}</span>
        </div>
      </div>

      <p class="sim-wall">A run is ephemeral — register values never persist into the model.</p>
    </template>
  </div>
</template>

<style scoped>
.sim-panel { padding: 0.75rem; font-size: 0.78rem; }
.sim-idle { padding: 1rem 0.25rem; text-align: center; color: var(--text-muted); }
.sim-wall {
  font-size: 0.64rem;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 0.6rem;
}
.sim-status { margin-bottom: 0.5rem; }
.sim-badge {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}
.sim-badge.running { background: var(--accent-soft); color: var(--accent); }
.sim-badge.done { background: rgba(122, 158, 94, 0.15); color: var(--sage); }
.sim-badge.blocked { background: rgba(212, 148, 66, 0.15); color: #d49442; }
.sim-controls {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.7rem;
}
.sim-btn {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.7rem;
}
.sim-btn.primary { border-color: var(--accent); color: var(--accent); }
.sim-btn.danger { border-color: #b85555; color: #b85555; }
.sim-btn:disabled { opacity: 0.4; cursor: default; }
.sim-section-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 0.25rem;
}
.sim-registers { margin-bottom: 0.7rem; }
.sim-empty { font-size: 0.68rem; color: var(--text-faint); font-style: italic; }
.register-row {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 0.25rem;
}
.register-id {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
}
.register-input {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
  font-family: var(--font-mono);
}
.sim-trajectory { max-height: 300px; overflow-y: auto; }
.trajectory-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.12rem 0.2rem;
  font-size: 0.68rem;
  border-left: 2px solid transparent;
}
.trajectory-row.current { border-left-color: var(--accent); background: var(--accent-soft); }
.trajectory-seq {
  font-family: var(--font-mono);
  color: var(--text-faint);
  width: 1.6rem;
  text-align: right;
}
.trajectory-node {
  font-family: var(--font-mono);
  color: var(--text);
}
.trajectory-kind { color: var(--text-faint); font-size: 0.6rem; }
.trajectory-note { color: var(--text-muted); font-size: 0.62rem; font-style: italic; }
</style>

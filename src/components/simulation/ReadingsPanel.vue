<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The readings panel (the Paneron-parity pass): the model's dynamic
// state as ONE coherent instrument readout — measured variables,
// calculated ones (expressions and TABLE lookups, live), and the GATE
// RAILS: each gateway's branches on a rail, the branch that would
// currently fire lit, BLOCKED amber when none would. The registers
// come from whichever engine is live (the twin or the simulation);
// nothing here is model content.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { readingsOf, type Readings } from '../../lib/readings';
import { useModelStore } from '../../stores/model';
import { useSimStore } from '../../stores/simulation';
import { useTwinStore } from '../../stores/twin';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const sim = useSimStore();
const twin = useTwinStore();

const readings = computed<Readings>(() => {
  void modelStore.version;
  if (twin.run) return readingsOf(props.model, twin.run.registers, 'twin', [...twin.streamedVariables]);
  if (sim.run) return readingsOf(props.model, sim.run.registers, 'simulation');
  return readingsOf(props.model, {}, '');
});

const KIND_LABEL: Record<string, string> = {
  measured: 'measured',
  derived: 'calc',
  table: 'lookup',
};

const STATE_LABEL: Record<string, string> = {
  routed: 'routed',
  default: 'default',
  blocked: 'BLOCKED',
};
</script>

<template>
  <div class="readings" data-testid="readings-panel">
    <div class="readings-engine">
      <span v-if="readings.engine" class="engine-chip live" :data-testid="'readings-engine'">{{ readings.engine }} live</span>
      <span v-else class="engine-chip idle">no engine running</span>
      <span class="readings-law">readings never touch the model</span>
    </div>

    <template v-if="readings.variables.length">
      <div class="readings-label">variables</div>
      <div v-for="v in readings.variables" :key="v.id" class="reading-row" :data-testid="`reading-${v.id}`">
        <span class="reading-kind" :class="v.kind">{{ KIND_LABEL[v.kind] ?? v.kind }}</span>
        <code class="reading-id">{{ v.id }}</code>
        <span class="reading-value" :class="{ empty: v.value === '', failed: !!v.note }" :data-testid="`reading-value-${v.id}`">{{
          v.note ? '—' : (v.value === '' ? '·' : v.value)
        }}</span>
        <span v-if="v.note" class="reading-note" :title="v.note">{{ v.note.slice(0, 42) }}</span>
      </div>
    </template>
    <div v-else class="readings-empty">this model declares no variables</div>

    <template v-if="readings.gates.length">
      <div class="readings-label">gates</div>
      <div v-for="g in readings.gates" :key="g.gatewayId" class="gate-rail-block" :data-testid="`gate-${g.gatewayId}`">
        <div class="gate-head">
          <code class="gate-id">{{ g.gatewayId }}</code>
          <span class="gate-state" :class="g.state" :data-testid="`gate-state-${g.gatewayId}`">{{ STATE_LABEL[g.state] }}</span>
        </div>
        <div class="gate-rail">
          <div
            v-for="b in g.branches"
            :key="b.edgeId"
            class="gate-node"
            :class="{ fires: b.fires, unknown: b.unknown, default: b.isDefault }"
            :title="b.isDefault ? 'the catch-all' : b.condition"
          >
            <span class="gate-node-dot" />
            <code class="gate-node-id">{{ b.edgeId }}</code>
            <span v-if="b.isDefault" class="gate-node-tag">default</span>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!readings.engine" class="readings-invite">
      Start the twin or the simulation — the readings light up with the live registers.
    </div>
  </div>
</template>

<style scoped>
.readings { padding: 0.6rem; font-size: 0.75rem; }
.readings-engine { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.engine-chip {
  font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase;
  letter-spacing: 0.08em; padding: 0.12rem 0.4rem; border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-soft);
}
.engine-chip.live { color: var(--sage); border-color: var(--sage); }
.engine-chip.idle { color: var(--text-faint); }
.readings-law { font-size: 0.6rem; color: var(--text-faint); margin-left: auto; }

.readings-label {
  font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text-faint); margin: 0.6rem 0 0.3rem;
}

.reading-row {
  display: grid; grid-template-columns: 3.4rem 1fr auto; gap: 0.45rem;
  align-items: baseline; padding: 0.14rem 0; border-bottom: 1px dotted rgba(128,128,128,0.18);
}
.reading-kind {
  font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-faint);
}
.reading-kind.derived { color: var(--accent); }
.reading-kind.table { color: var(--data-in, #4a7a9b); }
.reading-id { font-size: 0.7rem; }
.reading-value {
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
  font-size: 0.78rem; font-weight: 600; text-align: right;
}
.reading-value.empty { opacity: 0.35; font-weight: 400; }
.reading-value.failed { color: #b45309; }
.reading-note {
  grid-column: 2 / 4; font-size: 0.6rem; color: #b45309; opacity: 0.85;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* The signature: the gate rail — routing truth, lit. */
.gate-rail-block { margin-bottom: 0.55rem; }
.gate-head { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.2rem; }
.gate-id { font-size: 0.68rem; }
.gate-state {
  font-family: var(--font-mono); font-size: 0.56rem; text-transform: uppercase;
  letter-spacing: 0.1em; padding: 0.06rem 0.35rem; border-radius: var(--radius-sm, 3px);
}
.gate-state.routed { color: var(--sage); }
.gate-state.default { color: var(--text-faint); }
.gate-state.blocked { color: #b45309; border: 1px solid #b45309; }
.gate-rail { display: flex; gap: 0.3rem; align-items: center; }
.gate-rail::before { content: ''; flex: 0 0 0.6rem; height: 2px; background: var(--border-soft); }
.gate-rail::after { content: ''; flex: 1; height: 2px; background: var(--border-soft); }
.gate-node {
  display: inline-flex; gap: 0.3rem; align-items: center;
  border: 1px solid var(--border-soft); border-radius: 999px;
  padding: 0.1rem 0.5rem; opacity: 0.55;
}
.gate-node.fires {
  opacity: 1; border-color: var(--sage);
  box-shadow: 0 0 0 1px var(--sage), 0 0 10px rgba(122, 154, 122, 0.25);
}
.gate-node.unknown { opacity: 0.8; border-style: dotted; }
.gate-node-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.7; }
.gate-node.fires .gate-node-dot { background: var(--sage); opacity: 1; }
.gate-node-id { font-size: 0.62rem; }
.gate-node-tag {
  font-family: var(--font-mono); font-size: 0.52rem; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-faint);
}
.gate-node.default { border-style: dashed; }

.readings-empty, .readings-invite { font-size: 0.68rem; color: var(--text-faint); font-style: italic; padding: 0.25rem 0; }
</style>

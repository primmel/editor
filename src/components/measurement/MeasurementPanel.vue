<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The measurement panel (TODO.editor/16) — the selected process's
// declared measurement points: the variable-setting rows (value +
// unit + uncertainty), the validation chip per row, and the formatted
// result preview. Values are run values (the store), never model
// content — stated on the panel.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { formatResult, measurementRows, validateValue, type RowVerdict } from '../../lib/measurement';
import { useMeasurementStore } from '../../stores/measurement';
import { useUiStore } from '../../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();
const store = useMeasurementStore();

const processId = computed(() => (ui.selection?.type === 'process' ? ui.selection.id : null));

const rows = computed(() => {
  if (!processId.value) return [];
  return measurementRows(props.model, processId.value);
});

const valuesByRow = computed(() => {
  const out: Record<string, { value: string; unit: string; uncertainty: string }> = {};
  if (!processId.value) return out;
  for (const row of rows.value) out[row.id] = store.get(processId.value, row.id);
  return out;
});

const verdicts = computed(() => {
  const out: Record<string, RowVerdict> = {};
  for (const row of rows.value) out[row.id] = validateValue(row, valuesByRow.value[row.id]?.value ?? '');
  return out;
});

const preview = computed(() => formatResult(rows.value, valuesByRow.value));

const VERDICT_LABEL: Record<RowVerdict, string> = {
  valid: 'valid',
  warning: 'type mismatch',
  missing: 'missing',
};

function onField(measureId: string, key: 'value' | 'unit' | 'uncertainty', e: Event) {
  if (!processId.value) return;
  store.set(processId.value, measureId, { [key]: (e.target as HTMLInputElement).value });
}
</script>

<template>
  <div class="measurement-panel" data-testid="measurement-panel">
    <div class="measurement-header">
      measurements
      <span v-if="processId" class="measurement-target">{{ processId }}</span>
    </div>

    <div v-if="!processId" class="measurement-empty">select a process to set its measurements</div>
    <div v-else-if="!rows.length" class="measurement-empty">
      this process declares no measurement points (the validate_measurement facet)
    </div>

    <template v-else>
      <div v-for="row in rows" :key="row.id" class="measurement-row" :data-testid="`measure-${row.id}`">
        <div class="measure-row-head">
          <code class="measure-id">{{ row.id }}</code>
          <span v-if="row.declared?.type" class="measure-type">{{ row.declared.type }}</span>
          <span
            class="measure-verdict"
            :class="verdicts[row.id]"
            :data-testid="`verdict-${row.id}`"
          >{{ VERDICT_LABEL[verdicts[row.id]!] }}</span>
        </div>
        <div class="measure-fields">
          <input
            class="measure-input"
            :value="valuesByRow[row.id]?.value ?? ''"
            placeholder="value"
            :data-testid="`value-${row.id}`"
            @change="onField(row.id, 'value', $event)"
          />
          <input
            class="measure-input small"
            :value="valuesByRow[row.id]?.unit ?? ''"
            placeholder="unit"
            :data-testid="`unit-${row.id}`"
            @change="onField(row.id, 'unit', $event)"
          />
          <input
            class="measure-input small"
            :value="valuesByRow[row.id]?.uncertainty ?? ''"
            placeholder="±unc"
            :data-testid="`unc-${row.id}`"
            @change="onField(row.id, 'uncertainty', $event)"
          />
        </div>
        <div v-if="row.declared?.definition" class="measure-definition">{{ row.declared.definition }}</div>
      </div>

      <div class="measure-preview">
        <div class="measure-preview-label">result</div>
        <pre data-testid="measure-preview">{{ preview }}</pre>
      </div>
    </template>

    <p class="measure-wall">run values are evidence-adjacent — never model content</p>
  </div>
</template>

<style scoped>
.measurement-panel {
  border-top: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
}
.measurement-header {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.measurement-target { color: var(--accent); text-transform: none; letter-spacing: 0; }
.measurement-empty {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  padding: 0.3rem 0;
}
.measurement-row {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.45rem;
  margin-bottom: 0.35rem;
}
.measure-row-head {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-bottom: 0.25rem;
}
.measure-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
}
.measure-type {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--text-faint);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 0.25rem;
}
.measure-verdict {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-sm);
}
.measure-verdict.valid { color: var(--sage); background: rgba(122, 158, 94, 0.12); }
.measure-verdict.warning { color: #d49442; background: rgba(212, 148, 66, 0.12); }
.measure-verdict.missing { color: var(--text-faint); background: var(--bg-elevated); }
.measure-fields {
  display: grid;
  grid-template-columns: 1fr 4rem 4rem;
  gap: 0.3rem;
}
.measure-input {
  padding: 0.22rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
  font-family: var(--font-mono);
  min-width: 0;
}
.measure-definition {
  font-size: 0.62rem;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 0.2rem;
}
.measure-preview {
  margin-top: 0.5rem;
  border-top: 1px dashed var(--border);
  padding-top: 0.4rem;
}
.measure-preview-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 0.2rem;
}
.measure-preview pre {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.5rem;
  white-space: pre-wrap;
  margin: 0;
}
.measure-wall {
  font-size: 0.6rem;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 0.5rem;
}
</style>

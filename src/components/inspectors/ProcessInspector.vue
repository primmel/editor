<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The process inspector (TODO.editor/04) — every facet of a process,
// each edit a command: name, actor, modality, validate_provision,
// output/input (reference_data_registry), measurements.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Process, Standard } from '@primmel/primmel';
import { updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import PickerListEdit from '../fields/PickerListEdit.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; processId: string }>();
const modelStore = useModelStore();

const process = computed<Process | undefined>(() =>
  props.model.processes.find(p => p.id === props.processId));

const roleOptions = computed(() => props.model.roles.map(r => ({ id: r.id, label: r.name || r.id })));
const provisionOptions = computed(() => props.model.provisions.map(p => p.id));
const registryOptions = computed(() => props.model.regs.map(r => r.id));

function patch(p: Partial<Process>) {
  modelStore.execute(
    updateElement((a: Standard) => a.processes, props.processId, p),
  );
}

function onName(e: Event) {
  patch({ name: (e.target as HTMLInputElement).value });
}

function onActor(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  const role = props.model.roles.find(r => r.id === id) ?? null;
  patch({ actor: role });
}

function onModality(e: Event) {
  patch({ modality: (e.target as HTMLSelectElement).value });
}

function onProvisions(ids: string[]) {
  // The authored form is provisionRefs (the dump's source); `provision`
  // resolves at load — write both so the in-memory AST stays coherent.
  patch({
    provisionRefs: ids,
    provision: ids
      .map(id => props.model.provisions.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p),
  });
}

function onOutput(ids: string[]) {
  patch({
    output: ids.map(id => props.model.regs.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
  });
}

function onInput(ids: string[]) {
  patch({
    input: ids.map(id => props.model.regs.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r),
  });
}

function onMeasure(items: string[]) {
  patch({ measure: items });
}
</script>

<template>
  <div v-if="process" class="process-inspector" data-testid="process-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ process.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!process.name.trim()">
      <input
        class="text-input"
        :value="process.name"
        placeholder="Process name"
        data-testid="inspector-name"
        @change="onName"
      />
    </InspectorField>

    <InspectorField label="actor" required :missing="!process.actor">
      <select class="select-input" :value="process.actor?.id ?? ''" data-testid="inspector-actor" @change="onActor">
        <option value="">— select role —</option>
        <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
      </select>
    </InspectorField>

    <InspectorField label="modality">
      <select class="select-input" :value="process.modality" data-testid="inspector-modality" @change="onModality">
        <option value="SHALL">SHALL</option>
        <option value="SHOULD">SHOULD</option>
        <option value="MAY">MAY</option>
      </select>
    </InspectorField>

    <InspectorField label="validate_provision">
      <PickerListEdit
        :items="process.provisionRefs"
        :options="provisionOptions"
        placeholder="add provision…"
        @update="onProvisions"
      />
    </InspectorField>

    <InspectorField label="output (reference_data_registry)">
      <PickerListEdit
        :items="process.output.map(r => r.id)"
        :options="registryOptions"
        placeholder="add output…"
        @update="onOutput"
      />
    </InspectorField>

    <InspectorField label="input (reference_data_registry)">
      <PickerListEdit
        :items="process.input.map(r => r.id)"
        :options="registryOptions"
        placeholder="add input…"
        @update="onInput"
      />
    </InspectorField>

    <InspectorField label="validate_measurement">
      <StringListEdit
        :items="process.measure"
        placeholder="measurement id…"
        @update="onMeasure"
      />
    </InspectorField>
  </div>
</template>

<style scoped>
.process-inspector { padding: 0.25rem 0; }
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.text-input, .select-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
}
.text-input:focus, .select-input:focus {
  outline: none;
  border-color: var(--accent);
}
</style>

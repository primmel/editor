<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The registry inspector (TODO.editor/05) — the data registry: title
// and the data_class it carries.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

const props = defineProps<{ model: Standard; registryId: string }>();
const modelStore = useModelStore();

const registry = computed(() => props.model.regs.find(r => r.id === props.registryId));
const classOptions = computed(() => props.model.dataclasses.map(d => d.id));

function onTitle(e: Event) {
  modelStore.execute(
    updateElement((a: Standard) => a.regs, props.registryId, {
      title: (e.target as HTMLInputElement).value,
    }),
  );
}

function onDataClass(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  const data = props.model.dataclasses.find(d => d.id === id) ?? null;
  modelStore.execute(
    updateElement((a: Standard) => a.regs, props.registryId, { data }),
  );
}
</script>

<template>
  <div v-if="registry" class="registry-inspector" data-testid="registry-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ registry.id }}</code>
    </InspectorField>

    <InspectorField label="title" required :missing="!registry.title.trim()">
      <input
        class="text-input"
        :value="registry.title"
        data-testid="registry-title"
        @change="onTitle"
      />
    </InspectorField>

    <InspectorField label="data_class" hint="the class this registry carries">
      <select
        class="select-input"
        :value="registry.data?.id ?? ''"
        data-testid="registry-data-class"
        @change="onDataClass"
      >
        <option value="">— none —</option>
        <option v-for="c in classOptions" :key="c" :value="c">{{ c }}</option>
      </select>
    </InspectorField>
  </div>
</template>

<style scoped>
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
</style>

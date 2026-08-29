<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The formulas-used inspector (TODO.editor wave 03, window 2) — the
// per-test evaluation-formula trace: the block id IS the conformance
// test reference; name + description, the formula id list (the
// registry's quantity names — snake_case per C94), and the clause-URN
// provenance (repeated source blocks collecting into sourceRefs).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';
import SourceRefListEdit from '../fields/SourceRefListEdit.vue';

type FormulasUsed = Standard['formulasUsed'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.formulasUsed;
const trace = computed(() => { void modelStore.version; return props.model.formulasUsed.find(f => f.id === props.elementId); });

function patch(field: keyof FormulasUsed, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<FormulasUsed>, label ?? `edit formulas used ${props.elementId}`));
}
</script>

<template>
  <div v-if="trace" class="formulas-used-inspector" data-testid="formulas-used-inspector">
    <InspectorField label="id" hint="the conformance-test reference this trace keys on">
      <code class="readonly-id">{{ trace.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!trace.name">
      <input class="text-input" :value="trace.name" data-testid="fu-name" @change="(e) => patch('name', (e.target as HTMLInputElement).value)" />
    </InspectorField>

    <InspectorField label="description" required :missing="!trace.description">
      <textarea class="text-input" rows="3" :value="trace.description" data-testid="fu-description" @change="(e) => patch('description', (e.target as HTMLTextAreaElement).value)" />
    </InspectorField>

    <InspectorField :label="`formulas (${trace.formulas.length})`" hint="the registry formula ids the test's evaluation invokes (snake_case, C94)">
      <StringListEdit :items="[...trace.formulas]" placeholder="add a formula id…" @update="(items) => patch('formulas', items, `edit formulas used ${props.elementId} formulas`)" />
    </InspectorField>

    <InspectorField :label="`sources (${trace.sourceRefs.length})`" hint="the clause-URN provenance — repeated source blocks">
      <SourceRefListEdit :items="trace.sourceRefs.map(s => ({ ...s }))" testid-prefix="fu-source" @update="(items) => patch('sourceRefs', items, `edit formulas used ${props.elementId} sources`)" />
    </InspectorField>
  </div>
</template>

<style scoped>
.readonly-id {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  word-break: break-all;
}
.text-input {
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
</style>

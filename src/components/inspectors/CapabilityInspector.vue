<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The capability inspector (TODO.editor wave 03) — the mixin surface:
// what the instrument CAN do. Label, description, the abstract marker,
// the composition facets (extends / requires), the declared parameters,
// and the satisfaction/verification chains (satisfies_requirements /
// verified_by_tests).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Capability } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.capabilities;
const cap = computed(() => { void modelStore.version; return props.model.capabilities.find(c => c.id === props.elementId); });

function patch(field: keyof Capability, e: Event) {
  if (!cap.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit capability ${props.elementId}`),
  );
}

function patchList(field: 'extends' | 'requires' | 'hasParameters' | 'satisfiesRequirements' | 'verifiedByTests' | 'referenceIds', items: string[]) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: items }, `edit capability ${props.elementId} ${field}`));
}
</script>

<template>
  <div v-if="cap" class="capability-inspector" data-testid="capability-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ cap.id }}</code>
    </InspectorField>

    <InspectorField label="label" required :missing="!cap.label">
      <input class="text-input" :value="cap.label" data-testid="capability-label" @change="patch('label', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="3" :value="cap.description" data-testid="capability-description" @change="patch('description', $event)" />
    </InspectorField>

    <InspectorField label="abstract" hint="an abstract capability is a mixin contract, never instantiated directly">
      <label class="check-line">
        <input type="checkbox" :checked="cap.abstract" data-testid="capability-abstract" @change="modelStore.execute(updateConstruct(listOf, props.elementId, { abstract: ($event.target as HTMLInputElement).checked }, `edit capability ${props.elementId} abstract`))" />
        abstract
      </label>
    </InspectorField>

    <InspectorField :label="`extends (${cap.extends.length})`">
      <StringListEdit :items="[...cap.extends]" placeholder="add a parent capability id…" @update="patchList('extends', $event)" />
    </InspectorField>

    <InspectorField :label="`requires (${cap.requires.length})`">
      <StringListEdit :items="[...cap.requires]" placeholder="add a required capability id…" @update="patchList('requires', $event)" />
    </InspectorField>

    <InspectorField :label="`parameters (${cap.hasParameters.length})`" hint="the attribute parameters this capability declares">
      <StringListEdit :items="[...cap.hasParameters]" placeholder="add a parameter id…" @update="patchList('hasParameters', $event)" />
    </InspectorField>

    <InspectorField :label="`satisfies requirements (${cap.satisfiesRequirements.length})`">
      <StringListEdit :items="[...cap.satisfiesRequirements]" placeholder="add a requirement id…" @update="patchList('satisfiesRequirements', $event)" />
    </InspectorField>

    <InspectorField :label="`verified by tests (${cap.verifiedByTests.length})`">
      <StringListEdit :items="[...cap.verifiedByTests]" placeholder="add a conformance test id…" @update="patchList('verifiedByTests', $event)" />
    </InspectorField>

    <InspectorField :label="`references (${cap.referenceIds.length})`">
      <StringListEdit :items="[...cap.referenceIds]" placeholder="add a reference id…" @update="patchList('referenceIds', $event)" />
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
.mono { font-family: var(--font-mono); }
.check-line { display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--text-soft); }
</style>

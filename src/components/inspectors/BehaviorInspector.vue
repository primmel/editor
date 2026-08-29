<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The behavior inspector (TODO.editor wave 03) — a response
// characteristic requirements bind to: kind, stimulus, response, the
// verifying tests, and the clause provenance (the source/sourceRefs
// alias discipline).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Behavior } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.behaviors;
const behavior = computed(() => { void modelStore.version; return props.model.behaviors.find(b => b.id === props.elementId); });

function patch(field: keyof Behavior, e: Event) {
  if (!behavior.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit behavior ${props.elementId}`),
  );
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!behavior.value) return;
  const source = { doc: behavior.value.source?.doc ?? '', clause: behavior.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The serializer walks `sourceRefs` (whose [0] ALIASES `source` on
  // load) — patch both, keeping the alias intact.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit behavior ${props.elementId} source`));
}
</script>

<template>
  <div v-if="behavior" class="behavior-inspector" data-testid="behavior-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ behavior.id }}</code>
    </InspectorField>

    <InspectorField label="kind" hint="temporal | procedural | …">
      <input class="text-input" :value="behavior.kind" data-testid="behavior-kind" @change="patch('kind', $event)" />
    </InspectorField>

    <InspectorField label="stimulus">
      <input class="text-input" :value="behavior.stimulus" data-testid="behavior-stimulus" @change="patch('stimulus', $event)" />
    </InspectorField>

    <InspectorField label="response" required :missing="!behavior.response">
      <textarea class="text-input" rows="3" :value="behavior.response" data-testid="behavior-response" @change="patch('response', $event)" />
    </InspectorField>

    <InspectorField :label="`verified by (${behavior.verifiedBy.length})`" hint="the conformance tests that probe this behavior">
      <StringListEdit :items="[...behavior.verifiedBy]" placeholder="add a test id…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { verifiedBy: items }, `edit behavior ${props.elementId} verified by`))" />
    </InspectorField>

    <InspectorField :label="`references (${behavior.referenceIds.length})`">
      <StringListEdit :items="[...behavior.referenceIds]" placeholder="add a reference id…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { referenceIds: items }, `edit behavior ${props.elementId} references`))" />
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="behavior.source?.doc ?? ''" data-testid="behavior-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="behavior.source?.clause ?? ''" data-testid="behavior-source-clause" @change="patchSource('clause', $event)" />
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
</style>

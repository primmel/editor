<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The artifact-instance inspector (TODO.editor wave 03, window 2) — one
// produced artifact, recorded as evidence (HAS): the definition link
// (`of`), the production timestamp, the producing subject instance
// (`by`), the content contract fields populated (QuantityValue rows —
// extra facets carry over), and the run/report links.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';
import QuantityValueMapEdit from '../fields/QuantityValueMapEdit.vue';

type ArtifactInstance = Standard['artifactInstances'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.artifactInstances;
const instance = computed(() => { void modelStore.version; return props.model.artifactInstances.find(i => i.id === props.elementId); });

function patch(field: keyof ArtifactInstance, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<ArtifactInstance>, label ?? `edit artifact instance ${props.elementId}`));
}

function patchScalar(field: 'of' | 'producedAt' | 'by', e: Event) {
  patch(field, (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div v-if="instance" class="artifact-instance-inspector" data-testid="artifact-instance-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ instance.id }}</code>
    </InspectorField>

    <InspectorField label="of" required :missing="!instance.of" hint="the artifact definition this instance conforms to">
      <input class="text-input mono" :value="instance.of" data-testid="ainst-of" @change="patchScalar('of', $event)" />
    </InspectorField>

    <InspectorField label="produced at" hint="the ISO-8601 production timestamp">
      <input class="text-input mono" :value="instance.producedAt" data-testid="ainst-produced-at" @change="patchScalar('producedAt', $event)" />
    </InspectorField>

    <InspectorField label="by" hint="the producing subject instance (sample id / twin ref)">
      <input class="text-input mono" :value="instance.by" data-testid="ainst-by" @change="patchScalar('by', $event)" />
    </InspectorField>

    <InspectorField :label="`content (${Object.keys(instance.content).length})`" hint="the contract fields, populated (value + unit)">
      <QuantityValueMapEdit :entries="instance.content" testid-prefix="ainst-content" @update="(v) => patch('content', v, `edit artifact instance ${props.elementId} content`)" />
    </InspectorField>

    <InspectorField :label="`links (${instance.links.length})`" hint="the run/report ids this instance is evidence for">
      <StringListEdit :items="[...instance.links]" placeholder="add a run/report id…" @update="(items) => patch('links', items, `edit artifact instance ${props.elementId} links`)" />
    </InspectorField>

    <InspectorField :label="`references (${instance.referenceIds.length})`">
      <StringListEdit :items="[...instance.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit artifact instance ${props.elementId} references`)" />
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

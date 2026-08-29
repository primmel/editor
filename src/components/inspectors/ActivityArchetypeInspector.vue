<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The activity-archetype inspector (TODO.editor wave 03, window 2) —
// one entry of an ISO/IEC 17000 activity-archetype register: the label
// (the term as it appears in the source standard), the source clause,
// the verbatim definition, and the parent kind (the type-of link).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type ActivityArchetype = Standard['activityArchetypes'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.activityArchetypes;
const archetype = computed(() => { void modelStore.version; return props.model.activityArchetypes.find(a => a.id === props.elementId); });

function patch(field: keyof ActivityArchetype, e: Event) {
  if (!archetype.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit activity archetype ${props.elementId}`),
  );
}
</script>

<template>
  <div v-if="archetype" class="activity-archetype-inspector" data-testid="activity-archetype-inspector">
    <InspectorField label="id" hint="the snake-case kind id a process's activity_kind references">
      <code class="readonly-id">{{ archetype.id }}</code>
    </InspectorField>

    <InspectorField label="label" required :missing="!archetype.label">
      <input class="text-input" :value="archetype.label" data-testid="aa-label" @change="patch('label', $event)" />
    </InspectorField>

    <InspectorField label="clause" hint="the source standard's clause the definition comes from">
      <input class="text-input mono" :value="archetype.clause" data-testid="aa-clause" @change="patch('clause', $event)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!archetype.definition">
      <textarea class="text-input" rows="3" :value="archetype.definition" data-testid="aa-definition" @change="patch('definition', $event)" />
    </InspectorField>

    <InspectorField label="parent" hint="the parent kind id (a stated type-of link); '' = top-level">
      <input class="text-input mono" :value="archetype.parent" data-testid="aa-parent" @change="patch('parent', $event)" />
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

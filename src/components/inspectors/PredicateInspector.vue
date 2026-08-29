<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The predicate inspector (TODO.editor wave 03, window 2) — one entry
// of the relation registry (docs/primmel/18): kind (citation |
// semantic), the description, the subject/target kind allowlists, the
// linker resolution policy, the inverse, and the transitive/symmetric
// flags.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type RefPredicate = Standard['predicates'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.predicates;
const predicate = computed(() => { void modelStore.version; return props.model.predicates.find(p => p.id === props.elementId); });

function patch(field: keyof RefPredicate, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<RefPredicate>, label ?? `edit predicate ${props.elementId}`));
}

function patchScalar(field: 'description' | 'resolution' | 'inverse', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchFlag(field: 'transitive' | 'symmetric', e: Event) {
  patch(field, (e.target as HTMLInputElement).checked, `edit predicate ${props.elementId} ${field}`);
}
</script>

<template>
  <div v-if="predicate" class="predicate-inspector" data-testid="predicate-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ predicate.id }}</code>
    </InspectorField>

    <InspectorField label="kind" hint="citation (a document anchor) | semantic (a model element)">
      <select class="text-input" :value="predicate.kind" data-testid="pred-kind" @change="(e) => patch('kind', (e.target as HTMLSelectElement).value)">
        <option value="">—</option>
        <option value="citation">citation</option>
        <option value="semantic">semantic</option>
      </select>
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="predicate.description" data-testid="pred-description" @change="patchScalar('description', $event)" />
    </InspectorField>

    <InspectorField :label="`subject kinds (${predicate.subjectKinds.length})`" hint="the element kinds allowed as subject (empty = any)">
      <StringListEdit :items="[...predicate.subjectKinds]" placeholder="add a kind…" @update="(items) => patch('subjectKinds', items, `edit predicate ${props.elementId} subject_kinds`)" />
    </InspectorField>

    <InspectorField :label="`target kinds (${predicate.targetKinds.length})`" hint="the target kinds allowed (empty = any)">
      <StringListEdit :items="[...predicate.targetKinds]" placeholder="add a kind…" @update="(items) => patch('targetKinds', items, `edit predicate ${props.elementId} target_kinds`)" />
    </InspectorField>

    <InspectorField label="resolution" hint="the linker's resolution policy (must-resolve proves the target exists)">
      <input class="text-input mono" :value="predicate.resolution" data-testid="pred-resolution" @change="patchScalar('resolution', $event)" />
    </InspectorField>

    <InspectorField label="inverse" hint="the inverse predicate id">
      <input class="text-input mono" :value="predicate.inverse" data-testid="pred-inverse" @change="patchScalar('inverse', $event)" />
    </InspectorField>

    <InspectorField label="flags">
      <label class="flag-row"><input type="checkbox" :checked="predicate.transitive" data-testid="pred-transitive" @change="patchFlag('transitive', $event)" /> transitive</label>
      <label class="flag-row"><input type="checkbox" :checked="predicate.symmetric" data-testid="pred-symmetric" @change="patchFlag('symmetric', $event)" /> symmetric</label>
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
.flag-row { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.2rem; }
</style>

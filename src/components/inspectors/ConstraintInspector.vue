<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The constraint inspector (TODO.editor wave 03) — the domain
// constraint («inv» stereotype): the subject's own intrinsic validity
// rule. The machine-checkable OCL `check`, the REQUIRED violation
// meaning (what a violation MEANS — recorded on the invalidated
// judgment), the on_violation verdict (invalid | indeterminate — never
// a fail), and the clause provenance.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Constraint } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.constraints;
const constraint = computed(() => { void modelStore.version; return props.model.constraints.find(c => c.id === props.elementId); });

function patch(field: keyof Constraint, e: Event) {
  if (!constraint.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit constraint ${props.elementId}`),
  );
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!constraint.value) return;
  const source = { doc: constraint.value.source?.doc ?? '', clause: constraint.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The serializer walks `sourceRefs` (whose [0] ALIASES `source` on
  // load) — replacing `source` alone would shadow the edit behind the
  // old aliased object. Patch both, keeping the alias intact.
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit constraint ${props.elementId} source`),
  );
}
</script>

<template>
  <div v-if="constraint" class="constraint-inspector" data-testid="constraint-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ constraint.id }}</code>
    </InspectorField>

    <InspectorField label="stereotype" hint="the constraint stereotype — inv (an invariant on the subject)">
      <input class="text-input mono" :value="constraint.stereotype" data-testid="constraint-stereotype" @change="patch('stereotype', $event)" />
    </InspectorField>

    <InspectorField label="name" required :missing="!constraint.name">
      <input class="text-input" :value="constraint.name" data-testid="constraint-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="check" required :missing="!constraint.check" hint="the machine-checkable invariant as OCL over the subject's declared anatomy (model.parameters.*, sample.test_context.*, …)">
      <textarea class="text-input mono" rows="4" :value="constraint.check" data-testid="constraint-check" @change="patch('check', $event)" />
    </InspectorField>

    <InspectorField label="violation meaning" required :missing="!constraint.violationMeaning" hint="what a violation MEANS — recorded on the invalidated judgment">
      <textarea class="text-input" rows="4" :value="constraint.violationMeaning" data-testid="constraint-violation-meaning" @change="patch('violationMeaning', $event)" />
    </InspectorField>

    <InspectorField label="on violation" hint="invalid (void measurement) | indeterminate (cannot be judged) — never a fail">
      <select class="text-input" :value="constraint.onViolation" data-testid="constraint-on-violation" @change="patch('onViolation', $event)">
        <option value="invalid">invalid</option>
        <option value="indeterminate">indeterminate</option>
      </select>
    </InspectorField>

    <InspectorField label="source document" hint="the normative anchor — e.g. urn:oiml:pub:r:60-1:2021">
      <input class="text-input mono" :value="constraint.source?.doc ?? ''" data-testid="constraint-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="constraint.source?.clause ?? ''" data-testid="constraint-source-clause" @change="patchSource('clause', $event)" />
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

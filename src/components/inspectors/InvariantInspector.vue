<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The invariant inspector (TODO.editor wave 03, window 2) — a named
// architecture invariant: name, statement, severity, the applies_to
// targets, the provenance string, and the enforcement — EITHER the
// aspirational marker OR the claim list (kernel:C<n> | linker:<name> |
// gate:<name>), never both (C90 owns the XOR; the UI enforces it by
// construction).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type Invariant = Standard['invariants'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.invariants;
const invariant = computed(() => { void modelStore.version; return props.model.invariants.find(i => i.id === props.elementId); });

function patch(field: keyof Invariant, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Invariant>, label ?? `edit invariant ${props.elementId}`));
}

function patchScalar(field: 'name' | 'statement' | 'severity' | 'source', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchAspirational(e: Event) {
  const aspirational = (e.target as HTMLInputElement).checked;
  // C90's XOR: aspirational clears the claims; un-marking starts an
  // empty claim list (the author adds the first claim).
  patch('enforcement', { aspirational, claims: [] }, `edit invariant ${props.elementId} enforcement`);
}

function patchClaims(items: string[]) {
  patch('enforcement', { aspirational: false, claims: items }, `edit invariant ${props.elementId} enforcement claims`);
}
</script>

<template>
  <div v-if="invariant" class="invariant-inspector" data-testid="invariant-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ invariant.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!invariant.name">
      <input class="text-input" :value="invariant.name" data-testid="inv-name" @change="patchScalar('name', $event)" />
    </InspectorField>

    <InspectorField label="statement" required :missing="!invariant.statement">
      <textarea class="text-input" rows="3" :value="invariant.statement" data-testid="inv-statement" @change="patchScalar('statement', $event)" />
    </InspectorField>

    <InspectorField label="severity" required :missing="!invariant.severity" hint="free vocabulary — error | warning | notice | …">
      <input class="text-input" :value="invariant.severity" data-testid="inv-severity" @change="patchScalar('severity', $event)" />
    </InspectorField>

    <InspectorField :label="`applies to (${invariant.appliesTo.length})`" hint="the construct/entity names the invariant constrains">
      <StringListEdit :items="[...invariant.appliesTo]" placeholder="add a construct name…" @update="(items) => patch('appliesTo', items, `edit invariant ${props.elementId} applies_to`)" />
    </InspectorField>

    <InspectorField label="source" hint="provenance: doc path + anchor">
      <input class="text-input mono" :value="invariant.source" data-testid="inv-source" @change="patchScalar('source', $event)" />
    </InspectorField>

    <InspectorField label="enforcement" hint="EITHER aspirational OR the claim list (C90), never both">
      <label class="aspirational-row">
        <input type="checkbox" :checked="invariant.enforcement.aspirational" data-testid="inv-aspirational" @change="patchAspirational" />
        aspirational (declared, not yet machine-enforced)
      </label>
      <StringListEdit
        v-if="!invariant.enforcement.aspirational"
        :items="[...invariant.enforcement.claims]"
        placeholder="kernel:C32 | linker:<name> | gate:<name>"
        @update="patchClaims"
      />
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
.aspirational-row { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.3rem; }
</style>

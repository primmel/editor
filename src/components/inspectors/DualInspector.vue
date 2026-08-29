<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The dual inspector (TODO.editor wave 03, window 2) — the IS↔HAS value
// duality: ONE attribute in two aspect roles — designed (the specified
// side, with tolerance) and exhibited (the measured side, with
// uncertainty). Both roles optional individually; at least one must be
// present (the linter's C34) — the remove buttons never drop the last.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Dual } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type QuantityValue = NonNullable<Dual['designed']>;
type Role = 'designed' | 'exhibited';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.duals;
const dual = computed(() => { void modelStore.version; return props.model.duals.find(d => d.id === props.elementId); });

/** The kernel's value-token coercion: a numeric literal stays a number,
 *  anything else stays the string as written (dumpScalarToken quotes it). */
const NUMERIC = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const coerce = (raw: string): string | number => NUMERIC.test(raw.trim()) ? Number(raw.trim()) : raw;

function patchScalar(e: Event) {
  if (!dual.value) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { attribute: (e.target as HTMLInputElement).value }, `edit dual ${props.elementId}`));
}

function patchRole(role: Role, field: keyof QuantityValue, raw: string) {
  const d = dual.value;
  if (!d) return;
  const current: QuantityValue = d[role] ?? { value: '' };
  let next: QuantityValue = { ...current };
  if (field === 'value') next.value = coerce(raw);
  else if (raw === '') delete next[field];
  else if (field === 'uncertainty' || field === 'tolerance') next[field] = coerce(raw);
  else next[field] = raw;
  modelStore.execute(updateConstruct(listOf, props.elementId, { [role]: next }, `edit dual ${props.elementId} ${role}`));
}

function addRole(role: Role) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [role]: { value: '' } }, `add dual ${props.elementId} ${role}`));
}

function removeRole(role: Role) {
  const d = dual.value;
  if (!d) return;
  // C34: at least one role stays — never drop the last.
  if (!d.designed || !d.exhibited) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { [role]: undefined }, `remove dual ${props.elementId} ${role}`));
}

function patchReferences(items: string[]) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { referenceIds: items }, `edit dual ${props.elementId} references`));
}
</script>

<template>
  <div v-if="dual" class="dual-inspector" data-testid="dual-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ dual.id }}</code>
    </InspectorField>

    <InspectorField label="attribute" required :missing="!dual.attribute" hint="the attribute definition both roles measure">
      <input class="text-input mono" :value="dual.attribute" data-testid="dual-attribute" @change="patchScalar" />
    </InspectorField>

    <InspectorField v-for="role in (['designed', 'exhibited'] as Role[])" :key="role" :label="role" :hint="role === 'designed' ? 'the IS side — the specified value (tolerance marks the band)' : 'the HAS side — the observed value (uncertainty the dispersion)'">
      <div v-if="dual[role]" class="role-block" :data-testid="`dual-${role}`">
        <div class="role-pair">
          <input class="text-input mono" :value="String(dual[role]!.value)" placeholder="value" :data-testid="`dual-${role}-value`" @change="patchRole(role, 'value', ($event.target as HTMLInputElement).value)" />
          <input class="text-input mono" :value="dual[role]!.unit ?? ''" placeholder="unit" :data-testid="`dual-${role}-unit`" @change="patchRole(role, 'unit', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="role-pair">
          <input class="text-input mono" :value="dual[role]!.quantityKind ?? ''" placeholder="quantity kind (unit override)" :data-testid="`dual-${role}-kind`" @change="patchRole(role, 'quantityKind', ($event.target as HTMLInputElement).value)" />
          <input
            class="text-input mono"
            :value="String(role === 'designed' ? dual[role]!.tolerance ?? '' : dual[role]!.uncertainty ?? '')"
            :placeholder="role === 'designed' ? 'tolerance' : 'uncertainty'"
            :data-testid="`dual-${role}-spread`"
            @change="patchRole(role, role === 'designed' ? 'tolerance' : 'uncertainty', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button v-if="dual.designed && dual.exhibited" type="button" class="role-remove" :data-testid="`dual-${role}-remove`" @click="removeRole(role)">remove {{ role }}</button>
      </div>
      <button v-else type="button" class="role-add" :data-testid="`dual-${role}-add`" @click="addRole(role)">+ {{ role }}</button>
    </InspectorField>

    <InspectorField :label="`references (${dual.referenceIds.length})`">
      <StringListEdit :items="[...dual.referenceIds]" placeholder="add a reference id…" @update="patchReferences" />
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
.role-block { display: grid; gap: 0.3rem; }
.role-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.role-add, .role-remove {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.68rem;
  padding: 0.2rem 0.5rem;
  justify-self: start;
}
</style>

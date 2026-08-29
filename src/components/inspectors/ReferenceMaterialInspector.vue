<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The reference-material inspector (TODO.editor wave 03, window 2) —
// the certified-material registry: kind/name/definition, the identity
// fields (the contract one instance carries), and the normative
// machine-checked constraints (rule + evidence bindings + the
// authority override + on_violation — invalidate voids the run, never
// a fail). The provenance folds to `ref derives-from` (the
// source/sourceRefs alias discipline).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { ReferenceMaterial } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import KeyValueListEdit from '../fields/KeyValueListEdit.vue';

type IdentityField = ReferenceMaterial['identityFields'][number];
type MaterialConstraint = ReferenceMaterial['constraints'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.referenceMaterials;
const material = computed(() => { void modelStore.version; return props.model.referenceMaterials.find(r => r.id === props.elementId); });

const identityFields = computed(() => { void modelStore.version; return (material.value?.identityFields ?? []).map(f => ({ ...f })); });
const constraints = computed(() => { void modelStore.version; return (material.value?.constraints ?? []).map(c => ({ ...c })); });

function patch(field: keyof ReferenceMaterial, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<ReferenceMaterial>, label ?? `edit reference material ${props.elementId}`));
}

function patchScalar(field: 'kind' | 'name' | 'definition', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const m = material.value;
  if (!m) return;
  const source = { doc: m.source?.doc ?? '', clause: m.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load,
  // folding to `ref derives-from`) — patch both in ONE command.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit reference material ${props.elementId} source`));
}

// ── identity fields ──────────────────────────────────────────────────
function patchIdentityField(index: number, field: keyof IdentityField, value: unknown) {
  patch('identityFields', identityFields.value.map((f, i) => i === index ? { ...f, [field]: value } : f), `edit identity field ${props.elementId}[${index}]`);
}

const draftFieldName = ref('');
function addIdentityField() {
  const name = draftFieldName.value.trim();
  if (!name || !material.value || identityFields.value.some(f => f.name === name)) return;
  patch('identityFields', [...identityFields.value, { name, description: '', unit: '', type: '', required: false }], `add identity field ${name}`);
  draftFieldName.value = '';
}

function removeIdentityField(index: number) {
  patch('identityFields', identityFields.value.filter((_, i) => i !== index), `remove identity field ${identityFields.value[index]?.name ?? index}`);
}

// ── constraints ──────────────────────────────────────────────────────
function patchConstraint(index: number, field: keyof MaterialConstraint, value: unknown) {
  patch('constraints', constraints.value.map((c, i) => i === index ? { ...c, [field]: value } : c), `edit constraint ${props.elementId}[${index}]`);
}

function patchConstraintSource(index: number, field: 'doc' | 'clause', e: Event) {
  const c = constraints.value[index];
  if (!c) return;
  const source = { doc: c.source?.doc ?? '', clause: c.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  patchConstraint(index, 'source', source);
}

function patchConstraintEvidence(index: number, entries: [string, string][]) {
  patchConstraint(index, 'evidence', Object.fromEntries(entries));
}

function addOverride(index: number) {
  patchConstraint(index, 'override', { rule: '', by: '', evidence: '' });
}

function removeOverride(index: number) {
  patchConstraint(index, 'override', null);
}

function patchOverride(index: number, field: 'rule' | 'by' | 'evidence', e: Event) {
  const c = constraints.value[index];
  if (!c?.override) return;
  patchConstraint(index, 'override', { ...c.override, [field]: (e.target as HTMLInputElement).value });
}

const draftConstraintId = ref('');
function addConstraint() {
  const id = draftConstraintId.value.trim();
  if (!id || !material.value || constraints.value.some(c => c.id === id)) return;
  patch('constraints', [...constraints.value, { id, description: '', rule: '', evidence: {}, override: null, onViolation: 'invalidate', source: null }], `add material constraint ${id}`);
  draftConstraintId.value = '';
}

function removeConstraint(index: number) {
  patch('constraints', constraints.value.filter((_, i) => i !== index), `remove material constraint ${constraints.value[index]?.id ?? index}`);
}
</script>

<template>
  <div v-if="material" class="reference-material-inspector" data-testid="reference-material-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ material.id }}</code>
    </InspectorField>

    <InspectorField label="kind" hint="certified_gas_mixture | reference_speed_meter | …">
      <input class="text-input" :value="material.kind" data-testid="rm-kind" @change="patchScalar('kind', $event)" />
    </InspectorField>

    <InspectorField label="name" required :missing="!material.name">
      <input class="text-input" :value="material.name" data-testid="rm-name" @change="patchScalar('name', $event)" />
    </InspectorField>

    <InspectorField label="definition">
      <textarea class="text-input" rows="3" :value="material.definition" data-testid="rm-definition" @change="patchScalar('definition', $event)" />
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="material.source?.doc ?? ''" data-testid="rm-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="material.source?.clause ?? ''" data-testid="rm-source-clause" @change="patchSource('clause', $event)" />
    </InspectorField>

    <InspectorField :label="`identity fields (${identityFields.length})`" hint="the contract one material instance carries (certified value, expiry, …)">
      <ul v-if="identityFields.length" class="entry-rows">
        <li v-for="(f, i) in identityFields" :key="i" class="entry-row" :data-testid="`rm-field-${f.name}`">
          <div class="entry-line">
            <code class="entry-id">{{ f.name }}</code>
            <label class="required-flag"><input type="checkbox" :checked="f.required" :data-testid="`rm-field-required-${f.name}`" @change="patchIdentityField(i, 'required', ($event.target as HTMLInputElement).checked)" /> required</label>
            <button type="button" class="row-remove" title="remove field" :data-testid="`rm-field-remove-${f.name}`" @click="removeIdentityField(i)">✕</button>
          </div>
          <input class="text-input" :value="f.description" placeholder="description" :data-testid="`rm-field-desc-${f.name}`" @change="patchIdentityField(i, 'description', ($event.target as HTMLInputElement).value)" />
          <div class="entry-pair">
            <input class="text-input mono" :value="f.unit" placeholder="unit" :data-testid="`rm-field-unit-${f.name}`" @change="patchIdentityField(i, 'unit', ($event.target as HTMLInputElement).value)" />
            <input class="text-input mono" :value="f.type" placeholder="type" :data-testid="`rm-field-type-${f.name}`" @change="patchIdentityField(i, 'type', ($event.target as HTMLInputElement).value)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftFieldName" class="text-input mono" placeholder="field name…" data-testid="rm-field-add" @keyup.enter="addIdentityField" />
        <button type="button" :disabled="!draftFieldName.trim()" data-testid="rm-field-add-btn" @click="addIdentityField">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`constraints (${constraints.length})`" hint="machine-checked rules — on_violation invalidate voids the run">
      <ul v-if="constraints.length" class="entry-rows">
        <li v-for="(c, i) in constraints" :key="i" class="entry-row" :data-testid="`rm-constraint-${c.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ c.id }}</code>
            <button type="button" class="row-remove" title="remove constraint" :data-testid="`rm-constraint-remove-${c.id}`" @click="removeConstraint(i)">✕</button>
          </div>
          <input class="text-input" :value="c.description" placeholder="description" :data-testid="`rm-constraint-desc-${c.id}`" @change="patchConstraint(i, 'description', ($event.target as HTMLInputElement).value)" />
          <input class="text-input mono" :value="c.rule" placeholder="rule (ocl{…})" :data-testid="`rm-constraint-rule-${c.id}`" @change="patchConstraint(i, 'rule', ($event.target as HTMLInputElement).value)" />
          <KeyValueListEdit
            :entries="Object.entries(c.evidence)"
            key-placeholder="rule identifier…"
            value-placeholder="evidence field id…"
            :testid-prefix="`rm-constraint-evidence-${c.id}`"
            @update="patchConstraintEvidence(i, $event)"
          />
          <div class="entry-pair">
            <input class="text-input mono" :value="c.onViolation" placeholder="on_violation (invalidate)" :data-testid="`rm-constraint-onviolation-${c.id}`" @change="patchConstraint(i, 'onViolation', ($event.target as HTMLInputElement).value)" />
            <input class="text-input mono" :value="c.source?.clause ?? ''" placeholder="source clause" :data-testid="`rm-constraint-clause-${c.id}`" @change="patchConstraintSource(i, 'clause', $event)" />
          </div>
          <div v-if="c.override" class="override-block">
            <div class="entry-line">
              <span class="override-label">override</span>
              <button type="button" class="row-remove" title="remove override" :data-testid="`rm-constraint-override-remove-${c.id}`" @click="removeOverride(i)">✕</button>
            </div>
            <input class="text-input mono" :value="c.override.rule" placeholder="relaxed rule (ocl{…})" :data-testid="`rm-constraint-override-rule-${c.id}`" @change="patchOverride(i, 'rule', $event)" />
            <div class="entry-pair">
              <input class="text-input mono" :value="c.override.by" placeholder="by (e.g. issuing_authority)" :data-testid="`rm-constraint-override-by-${c.id}`" @change="patchOverride(i, 'by', $event)" />
              <input class="text-input mono" :value="c.override.evidence" placeholder="evidence field id" :data-testid="`rm-constraint-override-evidence-${c.id}`" @change="patchOverride(i, 'evidence', $event)" />
            </div>
          </div>
          <button v-else type="button" class="row-add" :data-testid="`rm-constraint-override-add-${c.id}`" @click="addOverride(i)">+ override</button>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftConstraintId" class="text-input mono" placeholder="constraint id…" data-testid="rm-constraint-add" @keyup.enter="addConstraint" />
        <button type="button" :disabled="!draftConstraintId.trim()" data-testid="rm-constraint-add-btn" @click="addConstraint">+</button>
      </div>
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
.entry-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.entry-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.entry-line { display: flex; align-items: center; gap: 0.3rem; }
.entry-id { font-family: var(--font-mono); font-size: 0.72rem; flex: 1; }
.entry-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.entry-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
  justify-self: start;
}
.required-flag { display: flex; align-items: center; gap: 0.25rem; font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; }
.override-block {
  display: grid;
  gap: 0.25rem;
  border-left: 2px solid var(--border-strong);
  padding-left: 0.4rem;
}
.override-label { font-size: 0.62rem; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; flex: 1; }
</style>

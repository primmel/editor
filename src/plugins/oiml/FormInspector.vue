<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The form inspector (TODO.editor wave 03, window 2) — the declarative
// data-capture schema: the header facets (name/description/section/
// scope, the class + process links), the requirement evidence links,
// the notes, the named instances, the machine-checked constraints, the
// pass_fail block, and the FIELDS — each field's core facets editable
// (type/label/unit/symbol/verdict/enum/required/required_when/default/
// targets), the deep facets (evaluation, calculation bindings, values,
// series, nested fields, subform refs) summarized read-only.
//
// KERNEL GAP (pinned in v3-constructs-2.test.ts — 1.8.0, the fix is
// upstream primmel-ts): the field parser reads `bind` (the subject-chain
// binding path) but dumpFormField never emits it — an edit through the
// save path would silently strip it. The facet renders READ-ONLY here;
// author it in the code view.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../../components/fields/InspectorField.vue';
import StringListEdit from '../../components/fields/StringListEdit.vue';

type Form = Standard['forms'][number];
type FormField = Form['fields'][number];
type FormInstance = Form['formInstances'][number];
type FormConstraint = Form['formConstraints'][number];
type PassFailDerivation = NonNullable<Form['passFail']>['derivations'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.forms;
const form = computed(() => { void modelStore.version; return props.model.forms.find(f => f.id === props.elementId); });

const fields = computed(() => { void modelStore.version; return (form.value?.fields ?? []).map(f => ({ ...f })); });
const formInstances = computed(() => { void modelStore.version; return (form.value?.formInstances ?? []).map(f => ({ ...f })); });
const formConstraints = computed(() => { void modelStore.version; return (form.value?.formConstraints ?? []).map(c => ({ ...c })); });

function patch(field: keyof Form, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Form>, label ?? `edit form ${props.elementId}`));
}

function patchScalar(field: 'name' | 'description' | 'section' | 'scope' | 'dataClassId' | 'headerFormId' | 'conformanceProcessId', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

// ── fields ───────────────────────────────────────────────────────────
function patchField(index: number, field: keyof FormField, value: unknown) {
  patch('fields', fields.value.map((f, i) => i === index ? { ...f, [field]: value } : f), `edit field ${props.elementId}[${index}]`);
}

const draftFieldName = ref('');
function addField() {
  const name = draftFieldName.value.trim();
  if (!name || !form.value || fields.value.some(f => f.name === name)) return;
  // The parse-default field shape (parseFormField's zero block).
  patch('fields', [...fields.value, {
    name, type: 'string', typeDeclared: false, label: '', definition: '', unit: '', symbol: '',
    verdict: '', targets: [], dimension: '', enumRef: '', pattern: '', required: false,
    requiredWhen: '', refs: [], measurementMethod: '', calculationId: null, calculationBindings: [],
    derivation: '', evaluation: null, values: [], trueLabel: '', falseLabel: '', enumValues: [],
    defaultValue: '', hasDefault: false, referenceIds: [], fieldReferences: [],
    specificationReference: '', applicability: [], sourceDiscrepancy: null, fields: [],
    itemsType: '', subformRef: null,
  }], `add field ${name}`);
  draftFieldName.value = '';
}

function removeField(index: number) {
  patch('fields', fields.value.filter((_, i) => i !== index), `remove field ${fields.value[index]?.name ?? index}`);
}

/** The deep facets a field carries, as a read-only summary. */
function fieldDepth(f: FormField): string {
  const notes: string[] = [];
  if (f.evaluation) notes.push('evaluation');
  if (f.calculationId) notes.push(`calculation ${f.calculationId}`);
  if (f.calculationBindings.length) notes.push(`${f.calculationBindings.length} bindings`);
  if (f.values.length) notes.push(`${f.values.length} values`);
  if (f.enumValues.length) notes.push(`${f.enumValues.length} enum values`);
  if (f.series) notes.push('series');
  if (f.fields.length) notes.push(`${f.fields.length} nested fields`);
  if (f.subformRef) notes.push(`subform ${f.subformRef.subformId}`);
  if (f.applicability.length) notes.push('applicability');
  if (f.measurementMethod) notes.push(`method ${f.measurementMethod}`);
  return notes.join(' · ');
}

// ── instances ────────────────────────────────────────────────────────
function patchInstance(index: number, field: keyof FormInstance, e: Event) {
  patch('formInstances', formInstances.value.map((f, i) => i === index ? { ...f, [field]: (e.target as HTMLInputElement).value } : f), `edit form instance ${props.elementId}[${index}]`);
}

const draftInstanceId = ref('');
function addInstance() {
  const id = draftInstanceId.value.trim();
  if (!id || !form.value || formInstances.value.some(f => f.id === id)) return;
  patch('formInstances', [...formInstances.value, { id, name: '' }], `add form instance ${id}`);
  draftInstanceId.value = '';
}

function removeInstance(index: number) {
  patch('formInstances', formInstances.value.filter((_, i) => i !== index), `remove form instance ${formInstances.value[index]?.id ?? index}`);
}

// ── constraints ──────────────────────────────────────────────────────
function patchConstraint(index: number, field: keyof FormConstraint, value: unknown) {
  patch('formConstraints', formConstraints.value.map((c, i) => i === index ? { ...c, [field]: value } : c), `edit form constraint ${props.elementId}[${index}]`);
}

const draftConstraintId = ref('');
function addConstraint() {
  const id = draftConstraintId.value.trim();
  if (!id || !form.value || formConstraints.value.some(c => c.id === id)) return;
  patch('formConstraints', [...formConstraints.value, { id, rule: '', onViolation: 'invalid', notes: '', source: null }], `add form constraint ${id}`);
  draftConstraintId.value = '';
}

function removeConstraint(index: number) {
  patch('formConstraints', formConstraints.value.filter((_, i) => i !== index), `remove form constraint ${formConstraints.value[index]?.id ?? index}`);
}

// ── pass_fail ────────────────────────────────────────────────────────
function patchPassFail(field: 'criteria' | 'passIf', e: Event) {
  const pf = form.value?.passFail ?? { criteria: '', passIf: '', derivations: [] };
  patch('passFail', { ...pf, [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit form ${props.elementId} pass_fail`);
}

function addPassFail() {
  patch('passFail', { criteria: '', passIf: '', derivations: [] }, `add form ${props.elementId} pass_fail`);
}

function removePassFail() {
  patch('passFail', null, `remove form ${props.elementId} pass_fail`);
}

function patchDerivation(index: number, field: keyof PassFailDerivation, e: Event) {
  const pf = form.value?.passFail;
  if (!pf) return;
  patch('passFail', {
    ...pf,
    derivations: pf.derivations.map((d, i) => i === index ? { ...d, [field]: (e.target as HTMLInputElement).value } : d),
  }, `edit pass_fail derivation ${props.elementId}[${index}]`);
}

const draftDerivationName = ref('');
function addDerivation() {
  const pf = form.value?.passFail;
  const name = draftDerivationName.value.trim();
  if (!pf || !name || pf.derivations.some(d => d.name === name)) return;
  patch('passFail', { ...pf, derivations: [...pf.derivations, { name, calculation: '', forEach: '', unit: '' }] }, `add pass_fail derivation ${name}`);
  draftDerivationName.value = '';
}

function removeDerivation(index: number) {
  const pf = form.value?.passFail;
  if (!pf) return;
  patch('passFail', { ...pf, derivations: pf.derivations.filter((_, i) => i !== index) }, `remove pass_fail derivation ${pf.derivations[index]?.name ?? index}`);
}
</script>

<template>
  <div v-if="form" class="form-inspector" data-testid="form-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ form.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!form.name">
      <input class="text-input" :value="form.name" data-testid="form-name" @change="patchScalar('name', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="3" :value="form.description" data-testid="form-description" @change="patchScalar('description', $event)" />
    </InspectorField>

    <InspectorField label="section" hint="the grouping section (the report structure)">
      <input class="text-input" :value="form.section" data-testid="form-section" @change="patchScalar('section', $event)" />
    </InspectorField>

    <InspectorField label="scope" hint="e.g. administrative (free)">
      <input class="text-input" :value="form.scope" data-testid="form-scope" @change="patchScalar('scope', $event)" />
    </InspectorField>

    <InspectorField label="links" hint="data class · header form · conformance process">
      <div class="link-grid">
        <input class="text-input mono" :value="form.dataClassId" placeholder="data class" data-testid="form-data-class" @change="patchScalar('dataClassId', $event)" />
        <input class="text-input mono" :value="form.headerFormId" placeholder="header form" data-testid="form-header" @change="patchScalar('headerFormId', $event)" />
        <input class="text-input mono" :value="form.conformanceProcessId" placeholder="conformance process" data-testid="form-process" @change="patchScalar('conformanceProcessId', $event)" />
      </div>
    </InspectorField>

    <InspectorField :label="`requirements (${form.requirements.length})`" hint="the requirement ids this form provides evidence for">
      <StringListEdit :items="[...form.requirements]" placeholder="add a requirement id…" @update="(items) => patch('requirements', items, `edit form ${props.elementId} requirements`)" />
    </InspectorField>

    <InspectorField :label="`notes (${form.formNotes.length})`">
      <StringListEdit :items="[...form.formNotes]" placeholder="add a note…" @update="(items) => patch('formNotes', items, `edit form ${props.elementId} notes`)" />
    </InspectorField>

    <InspectorField :label="`instances (${formInstances.length})`" hint="named form instances (e.g. on the load cell)">
      <ul v-if="formInstances.length" class="entry-rows">
        <li v-for="(f, i) in formInstances" :key="i" class="entry-row">
          <div class="entry-line">
            <code class="entry-id">{{ f.id }}</code>
            <button type="button" class="row-remove" title="remove instance" :data-testid="`form-instance-remove-${f.id}`" @click="removeInstance(i)">✕</button>
          </div>
          <input class="text-input" :value="f.name" placeholder="display name" :data-testid="`form-instance-name-${f.id}`" @change="patchInstance(i, 'name', $event)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftInstanceId" class="text-input mono" placeholder="instance id…" data-testid="form-instance-add" @keyup.enter="addInstance" />
        <button type="button" :disabled="!draftInstanceId.trim()" data-testid="form-instance-add-btn" @click="addInstance">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`constraints (${formConstraints.length})`" hint="machine-checked form-level constraints">
      <ul v-if="formConstraints.length" class="entry-rows">
        <li v-for="(c, i) in formConstraints" :key="i" class="entry-row" :data-testid="`form-constraint-${c.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ c.id }}</code>
            <button type="button" class="row-remove" title="remove constraint" :data-testid="`form-constraint-remove-${c.id}`" @click="removeConstraint(i)">✕</button>
          </div>
          <input class="text-input mono" :value="c.rule" placeholder="rule (ocl{…})" :data-testid="`form-constraint-rule-${c.id}`" @change="patchConstraint(i, 'rule', ($event.target as HTMLInputElement).value)" />
          <div class="entry-pair">
            <input class="text-input mono" :value="c.onViolation" placeholder="on_violation" :data-testid="`form-constraint-onviolation-${c.id}`" @change="patchConstraint(i, 'onViolation', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="c.notes" placeholder="notes" :data-testid="`form-constraint-notes-${c.id}`" @change="patchConstraint(i, 'notes', ($event.target as HTMLInputElement).value)" />
          </div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftConstraintId" class="text-input mono" placeholder="constraint id…" data-testid="form-constraint-add" @keyup.enter="addConstraint" />
        <button type="button" :disabled="!draftConstraintId.trim()" data-testid="form-constraint-add-btn" @click="addConstraint">+</button>
      </div>
    </InspectorField>

    <InspectorField label="pass/fail" hint="the criteria + the pass_if expression">
      <div v-if="form.passFail" class="family-block" data-testid="form-pass-fail">
        <textarea class="text-input" rows="2" :value="form.passFail.criteria" placeholder="criteria" data-testid="form-pf-criteria" @change="patchPassFail('criteria', $event)" />
        <input class="text-input mono" :value="form.passFail.passIf" placeholder="pass_if (ocl{…})" data-testid="form-pf-pass-if" @change="patchPassFail('passIf', $event)" />
        <ul v-if="form.passFail.derivations.length" class="entry-rows">
          <li v-for="(d, i) in form.passFail.derivations" :key="i" class="entry-row">
            <div class="entry-line">
              <code class="entry-id">{{ d.name }}</code>
              <button type="button" class="row-remove" title="remove derivation" :data-testid="`form-pf-derivation-remove-${d.name}`" @click="removeDerivation(i)">✕</button>
            </div>
            <div class="entry-pair">
              <input class="text-input mono" :value="d.calculation" placeholder="calculation" :data-testid="`form-pf-derivation-calc-${d.name}`" @change="patchDerivation(i, 'calculation', $event)" />
              <input class="text-input mono" :value="d.forEach" placeholder="for_each" :data-testid="`form-pf-derivation-foreach-${d.name}`" @change="patchDerivation(i, 'forEach', $event)" />
            </div>
            <input class="text-input mono" :value="d.unit" placeholder="unit" :data-testid="`form-pf-derivation-unit-${d.name}`" @change="patchDerivation(i, 'unit', $event)" />
          </li>
        </ul>
        <div class="entry-add">
          <input v-model="draftDerivationName" class="text-input mono" placeholder="derivation name…" data-testid="form-pf-derivation-add" @keyup.enter="addDerivation" />
          <button type="button" :disabled="!draftDerivationName.trim()" data-testid="form-pf-derivation-add-btn" @click="addDerivation">+</button>
        </div>
        <button type="button" class="row-add" data-testid="form-pf-remove" @click="removePassFail">remove pass/fail</button>
      </div>
      <button v-else type="button" class="row-add" data-testid="form-pf-add" @click="addPassFail">+ pass/fail</button>
    </InspectorField>

    <InspectorField :label="`fields (${fields.length})`" hint="the capture fields — the deep facets (evaluation, bindings, values, series, nested, subform) summarize; bind is READ-ONLY (the kernel dump gap)">
      <ul v-if="fields.length" class="entry-rows">
        <li v-for="(f, i) in fields" :key="i" class="entry-row field-row" :data-testid="`form-field-${f.name}`">
          <div class="entry-line">
            <code class="entry-id">{{ f.name }}</code>
            <span class="field-type mono">{{ f.type }}</span>
            <label class="required-flag"><input type="checkbox" :checked="f.required" :data-testid="`form-field-required-${f.name}`" @change="patchField(i, 'required', ($event.target as HTMLInputElement).checked)" /> required</label>
            <button type="button" class="row-remove" title="remove field" :data-testid="`form-field-remove-${f.name}`" @click="removeField(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="f.type" placeholder="type" :data-testid="`form-field-type-${f.name}`" @change="patchField(i, 'type', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="f.label" placeholder="label" :data-testid="`form-field-label-${f.name}`" @change="patchField(i, 'label', ($event.target as HTMLInputElement).value)" />
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="f.unit" placeholder="unit" :data-testid="`form-field-unit-${f.name}`" @change="patchField(i, 'unit', ($event.target as HTMLInputElement).value)" />
            <input class="text-input mono" :value="f.symbol" placeholder="symbol" :data-testid="`form-field-symbol-${f.name}`" @change="patchField(i, 'symbol', ($event.target as HTMLInputElement).value)" />
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="f.verdict" placeholder="verdict id" :data-testid="`form-field-verdict-${f.name}`" @change="patchField(i, 'verdict', ($event.target as HTMLInputElement).value)" />
            <input class="text-input mono" :value="f.enumRef" placeholder="enum id" :data-testid="`form-field-enum-${f.name}`" @change="patchField(i, 'enumRef', ($event.target as HTMLInputElement).value)" />
          </div>
          <input v-if="f.bind" class="text-input mono" :value="f.bind" readonly title="the subject-chain binding path — READ-ONLY: the kernel dump does not emit bind (the fix is upstream); author it in the code view" :data-testid="`form-field-bind-${f.name}`" />
          <div v-if="fieldDepth(f)" class="depth-note" :data-testid="`form-field-depth-${f.name}`">{{ fieldDepth(f) }} — edited in the code view</div>
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftFieldName" class="text-input mono" placeholder="field name…" data-testid="form-field-add" @keyup.enter="addField" />
        <button type="button" :disabled="!draftFieldName.trim()" data-testid="form-field-add-btn" @click="addField">+</button>
      </div>
    </InspectorField>

    <InspectorField v-if="form.applicability.length" :label="`applicability (${form.applicability.length})`" hint="edited in the code view">
      <code class="readonly-id" data-testid="form-applicability">{{ form.applicability.map(a => `${a.dimension}: [${a.values.join(', ')}]`).join(' ') }}</code>
    </InspectorField>

    <InspectorField v-if="form.calculationContext" label="calculation context" hint="the shared header + dimensions + tables — edited in the code view">
      <code class="readonly-id" data-testid="form-calc-context">{{ form.calculationContext.header || 'declared' }}</code>
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
.link-grid { display: grid; gap: 0.3rem; }
.family-block { display: grid; gap: 0.3rem; }
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
.field-type { font-size: 0.65rem; color: var(--text-faint); }
.required-flag { display: flex; align-items: center; gap: 0.25rem; font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; }
.depth-note { font-size: 0.62rem; color: var(--text-faint); font-style: italic; }
</style>

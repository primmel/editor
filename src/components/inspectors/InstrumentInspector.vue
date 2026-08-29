<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The instrument inspector (TODO.editor wave 03, window 2) — the
// subject-TYPE definition (one per Recommendation): extends, the
// measurand, the variants, the classification dimensions with their
// values, the family block + criteria + defaults, the model group, the
// channel dimension, the provenance. The measurand block, components,
// structure relations, and the per-value payloads summarize read-only
// (the code view edits them — the cascades precedent).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';
import DimensionValuesEditor from '../fields/DimensionValuesEditor.vue';

type Instrument = Standard['instruments'][number];
type SubjectVariant = Instrument['variants'][number];
type ClassificationDimension = Instrument['dimensions'][number];
type DimensionValue = ClassificationDimension['values'][number];
type ModelGroupDef = NonNullable<Instrument['modelGroup']>;

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.instruments;
const instrument = computed(() => { void modelStore.version; return props.model.instruments.find(i => i.id === props.elementId); });

const variants = computed(() => { void modelStore.version; return (instrument.value?.variants ?? []).map(v => ({ ...v })); });
const dimensions = computed(() => { void modelStore.version; return (instrument.value?.dimensions ?? []).map(d => ({ ...d })); });

function patch(field: keyof Instrument, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Instrument>, label ?? `edit instrument ${props.elementId}`));
}

function patchScalar(field: 'extends' | 'definition' | 'note' | 'measurandKind' | 'perChannel', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const m = instrument.value;
  if (!m) return;
  const source = { doc: m.source?.doc ?? '', clause: m.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load) —
  // patch both in ONE command, keeping the alias.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit instrument ${props.elementId} source`));
}

// ── variants ─────────────────────────────────────────────────────────
function patchVariant(index: number, field: keyof SubjectVariant, e: Event) {
  patch('variants', variants.value.map((v, i) => i === index ? { ...v, [field]: (e.target as HTMLInputElement).value } : v), `edit variant ${props.elementId}[${index}]`);
}

const draftVariantId = ref('');
function addVariant() {
  const id = draftVariantId.value.trim();
  if (!id || !instrument.value || variants.value.some(v => v.id === id)) return;
  patch('variants', [...variants.value, { id, definition: '' }], `add variant ${id}`);
  draftVariantId.value = '';
}

function removeVariant(index: number) {
  patch('variants', variants.value.filter((_, i) => i !== index), `remove variant ${variants.value[index]?.id ?? index}`);
}

// ── dimensions ───────────────────────────────────────────────────────
function patchDimension(index: number, field: keyof ClassificationDimension, value: unknown) {
  patch('dimensions', dimensions.value.map((d, i) => i === index ? { ...d, [field]: value } : d), `edit dimension ${props.elementId}[${index}]`);
}

const draftDimensionId = ref('');
function addDimension() {
  const id = draftDimensionId.value.trim();
  if (!id || !instrument.value || dimensions.value.some(d => d.id === id)) return;
  patch('dimensions', [...dimensions.value, { id, label: '', scope: '', cardinality: 'single', labelSeparator: '', description: '', source: null, values: [] }], `add dimension ${id}`);
  draftDimensionId.value = '';
}

function removeDimension(index: number) {
  patch('dimensions', dimensions.value.filter((_, i) => i !== index), `remove dimension ${dimensions.value[index]?.id ?? index}`);
}

// ── dimension values ─────────────────────────────────────────────────
function patchValues(dimIndex: number, values: DimensionValue[], label: string) {
  patch('dimensions', dimensions.value.map((d, i) => i === dimIndex ? { ...d, values } : d), label);
}

function patchValue(dimIndex: number, valueIndex: number, field: 'label' | 'description', e: Event) {
  const values = (dimensions.value[dimIndex]?.values ?? []).map((v, i) => i === valueIndex ? { ...v, [field]: (e.target as HTMLInputElement).value } : v);
  patchValues(dimIndex, values, `edit dimension value ${props.elementId}[${dimIndex}][${valueIndex}]`);
}

function addDimensionValue(dimIndex: number, id: string) {
  const values = dimensions.value[dimIndex]?.values ?? [];
  if (!id || values.some(v => v.id === id)) return;
  patchValues(dimIndex, [...values, { id, label: '', description: '', payload: {}, implies: [] }], `add dimension value ${id}`);
}

function removeDimensionValue(dimIndex: number, valueIndex: number) {
  const values = (dimensions.value[dimIndex]?.values ?? []).filter((_, i) => i !== valueIndex);
  patchValues(dimIndex, values, `remove dimension value ${props.elementId}[${dimIndex}][${valueIndex}]`);
}

// ── family + model group ─────────────────────────────────────────────
function patchFamily(field: 'familyMetamodelClass' | 'familyDefinition' | 'familyNote', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchModelGroup(field: keyof ModelGroupDef, value: unknown) {
  const mg = instrument.value?.modelGroup ?? { definition: '', identicalCharacteristics: [], identicalAttributes: [] };
  patch('modelGroup', { ...mg, [field]: value }, `edit model group ${props.elementId}`);
}

function addModelGroup() {
  patch('modelGroup', { definition: '', identicalCharacteristics: [], identicalAttributes: [] }, `add model group ${props.elementId}`);
}

function removeModelGroup() {
  patch('modelGroup', null, `remove model group ${props.elementId}`);
}

function patchList(field: 'familyCriteria' | 'familyDefaultDimensions' | 'familyDefaultParameters' | 'referenceIds', items: string[]) {
  patch(field, items, `edit instrument ${props.elementId} ${field}`);
}
</script>

<template>
  <div v-if="instrument" class="instrument-inspector" data-testid="instrument-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ instrument.id }}</code>
    </InspectorField>

    <InspectorField label="extends" hint="the parent subject type">
      <input class="text-input mono" :value="instrument.extends" data-testid="inst-extends" @change="patchScalar('extends', $event)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!instrument.definition">
      <textarea class="text-input" rows="3" :value="instrument.definition" data-testid="inst-definition" @change="patchScalar('definition', $event)" />
    </InspectorField>

    <InspectorField label="note">
      <input class="text-input" :value="instrument.note ?? ''" data-testid="inst-note" @change="patchScalar('note', $event)" />
    </InspectorField>

    <InspectorField label="measurand kind" hint="the shorthand (e.g. force)">
      <input class="text-input" :value="instrument.measurandKind ?? ''" data-testid="inst-measurand-kind" @change="patchScalar('measurandKind', $event)" />
    </InspectorField>

    <InspectorField v-if="instrument.measurand" label="measurand" hint="the first-class measurand block with its measurement context — authored in the code view">
      <code class="readonly-id" data-testid="inst-measurand">{{ instrument.measurand.kind }}{{ instrument.measurand.context ? ` — on ${instrument.measurand.context.targetObject}` : '' }}</code>
    </InspectorField>

    <InspectorField label="channel dimension" hint="per_channel — requirements marked channel verify per selected value">
      <input class="text-input mono" :value="instrument.perChannel" data-testid="inst-per-channel" @change="patchScalar('perChannel', $event)" />
    </InspectorField>

    <InspectorField v-if="instrument.components.length" :label="`components (${instrument.components.length})`" hint="the domain-profile component classes — authored in the code view">
      <code class="readonly-id" data-testid="inst-components">{{ instrument.components.map(c => c.id).join(', ') }}</code>
    </InspectorField>

    <InspectorField v-if="instrument.structure.length" :label="`structure relations (${instrument.structure.length})`" hint="the designed composition (partOf / consists_of / connectsTo) — authored in the code view">
      <code class="readonly-id" data-testid="inst-structure">{{ instrument.structure.map(s => `${s.predicate} → ${s.target}`).join(', ') }}</code>
    </InspectorField>

    <InspectorField :label="`variants (${variants.length})`">
      <ul v-if="variants.length" class="entry-rows">
        <li v-for="(v, i) in variants" :key="i" class="entry-row" :data-testid="`inst-variant-${v.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ v.id }}</code>
            <button type="button" class="row-remove" title="remove variant" :data-testid="`inst-variant-remove-${v.id}`" @click="removeVariant(i)">✕</button>
          </div>
          <input class="text-input" :value="v.name ?? ''" placeholder="display name" :data-testid="`inst-variant-name-${v.id}`" @change="patchVariant(i, 'name', $event)" />
          <input class="text-input" :value="v.definition" placeholder="definition" :data-testid="`inst-variant-def-${v.id}`" @change="patchVariant(i, 'definition', $event)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftVariantId" class="text-input mono" placeholder="variant id…" data-testid="inst-variant-add" @keyup.enter="addVariant" />
        <button type="button" :disabled="!draftVariantId.trim()" data-testid="inst-variant-add-btn" @click="addVariant">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`dimensions (${dimensions.length})`" hint="the classification dimensions (single | set cardinality)">
      <ul v-if="dimensions.length" class="entry-rows">
        <li v-for="(d, i) in dimensions" :key="i" class="entry-row" :data-testid="`inst-dimension-${d.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ d.id }}</code>
            <button type="button" class="row-remove" title="remove dimension" :data-testid="`inst-dimension-remove-${d.id}`" @click="removeDimension(i)">✕</button>
          </div>
          <div class="entry-pair">
            <input class="text-input" :value="d.label" placeholder="label" :data-testid="`inst-dimension-label-${d.id}`" @change="patchDimension(i, 'label', ($event.target as HTMLInputElement).value)" />
            <select class="text-input" :value="d.cardinality" :data-testid="`inst-dimension-cardinality-${d.id}`" @change="patchDimension(i, 'cardinality', ($event.target as HTMLSelectElement).value)">
              <option value="">—</option>
              <option value="single">single</option>
              <option value="set">set</option>
            </select>
          </div>
          <div class="entry-pair">
            <input class="text-input mono" :value="d.scope" placeholder="scope (family | model | …)" :data-testid="`inst-dimension-scope-${d.id}`" @change="patchDimension(i, 'scope', ($event.target as HTMLInputElement).value)" />
            <input class="text-input" :value="d.description" placeholder="description" :data-testid="`inst-dimension-desc-${d.id}`" @change="patchDimension(i, 'description', ($event.target as HTMLInputElement).value)" />
          </div>
          <DimensionValuesEditor
            :values="d.values"
            :testid-prefix="`inst-dimension-${d.id}`"
            @patch="(vi, field, e) => patchValue(i, vi, field, e)"
            @add="(vid) => addDimensionValue(i, vid)"
            @remove="(vi) => removeDimensionValue(i, vi)"
          />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftDimensionId" class="text-input mono" placeholder="dimension id…" data-testid="inst-dimension-add" @keyup.enter="addDimension" />
        <button type="button" :disabled="!draftDimensionId.trim()" data-testid="inst-dimension-add-btn" @click="addDimension">+</button>
      </div>
    </InspectorField>

    <InspectorField label="family" hint="the family block — the metamodel class the family instantiates + its definition">
      <div class="family-block">
        <input class="text-input mono" :value="instrument.familyMetamodelClass ?? ''" placeholder="metamodel class (e.g. MeasuringInstrumentModelFamily)" data-testid="inst-family-class" @change="patchFamily('familyMetamodelClass', $event)" />
        <textarea class="text-input" rows="2" :value="instrument.familyDefinition ?? ''" placeholder="family definition" data-testid="inst-family-definition" @change="patchFamily('familyDefinition', $event)" />
      </div>
    </InspectorField>

    <InspectorField :label="`family criteria (${instrument.familyCriteria.length})`">
      <StringListEdit :items="[...instrument.familyCriteria]" placeholder="add a criterion…" @update="patchList('familyCriteria', $event)" />
    </InspectorField>

    <InspectorField :label="`family default dimensions (${instrument.familyDefaultDimensions.length})`">
      <StringListEdit :items="[...instrument.familyDefaultDimensions]" placeholder="add a dimension id…" @update="patchList('familyDefaultDimensions', $event)" />
    </InspectorField>

    <InspectorField :label="`family default parameters (${instrument.familyDefaultParameters.length})`">
      <StringListEdit :items="[...instrument.familyDefaultParameters]" placeholder="add a parameter id…" @update="patchList('familyDefaultParameters', $event)" />
    </InspectorField>

    <InspectorField label="model group" hint="the inner families — what the models of a group share">
      <div v-if="instrument.modelGroup" class="family-block" data-testid="inst-model-group">
        <textarea class="text-input" rows="2" :value="instrument.modelGroup.definition" placeholder="definition" data-testid="inst-mg-definition" @change="patchModelGroup('definition', ($event.target as HTMLTextAreaElement).value)" />
        <input class="text-input mono" :value="instrument.modelGroup.groupBy ?? ''" placeholder="group_by (the partitioning dimension)" data-testid="inst-mg-group-by" @change="patchModelGroup('groupBy', ($event.target as HTMLInputElement).value)" />
        <StringListEdit :items="[...instrument.modelGroup.identicalCharacteristics]" placeholder="identical characteristic…" @update="patchModelGroup('identicalCharacteristics', $event)" />
        <StringListEdit :items="[...instrument.modelGroup.identicalAttributes]" placeholder="identical attribute…" @update="patchModelGroup('identicalAttributes', $event)" />
        <button type="button" class="row-add" data-testid="inst-mg-remove" @click="removeModelGroup">remove model group</button>
      </div>
      <button v-else type="button" class="row-add" data-testid="inst-mg-add" @click="addModelGroup">+ model group</button>
    </InspectorField>

    <InspectorField :label="`references (${instrument.referenceIds.length})`">
      <StringListEdit :items="[...instrument.referenceIds]" placeholder="add a reference id…" @update="patchList('referenceIds', $event)" />
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="instrument.source?.doc ?? ''" data-testid="inst-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="instrument.source?.clause ?? ''" data-testid="inst-source-clause" @change="patchSource('clause', $event)" />
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
.family-block { display: grid; gap: 0.3rem; }
.value-note { font-size: 0.62rem; color: var(--text-faint); }
</style>

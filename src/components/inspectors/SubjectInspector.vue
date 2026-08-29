<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The subject inspector (TODO.editor wave 03) — the v3 subject's
// anatomy surface: IS (identity/design: metadata, provenance, design
// parameters, designed condition tiers, promises, artifacts), HAS
// (exhibition: attributes, dimensions, the state machine binding,
// characteristics, environmental context, artifact instances), DOES
// (the behavior references). The endpoint and serve bindings (the twin
// API surface) summarize read-only — their structured editor is the
// code view's, and a misplaced-aspect lint capture (C6) surfaces as a
// warning, never silently.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Subject } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import KeyValueListEdit from '../fields/KeyValueListEdit.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type SubjectPromise = Subject['is']['promises'][number];
type PromiseLevel = SubjectPromise['level'];
type SubjectCharacteristic = Subject['has']['characteristics'][string];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.subjects;
const subject = computed(() => { void modelStore.version; return props.model.subjects.find(s => s.id === props.elementId); });

// Fresh structures per version (the anatomy mutates in place).
const isFacets = computed(() => { void modelStore.version; const s = subject.value; return s ? { ...s.is } : null; });
const hasFacets = computed(() => { void modelStore.version; const s = subject.value; return s ? { ...s.has } : null; });
const promises = computed(() => { void modelStore.version; return (subject.value?.is.promises ?? []).map(p => ({ ...p })); });
const characteristics = computed(() => {
  void modelStore.version;
  return Object.entries(subject.value?.has.characteristics ?? {}).map(([id, c]) => ({ id, ...c }));
});

function patchIs(patch: Partial<Subject['is']>, label: string) {
  const s = subject.value;
  if (!s) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { is: { ...s.is, ...patch } }, label));
}

function patchHas(patch: Partial<Subject['has']>, label: string) {
  const s = subject.value;
  if (!s) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { has: { ...s.has, ...patch } }, label));
}

function patchDoes(behaviors: string[]) {
  const s = subject.value;
  if (!s) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { does: { ...s.does, behaviors } }, `edit subject ${props.elementId} behaviors`));
}

function patchMap(family: 'is' | 'has', field: 'metadata' | 'provenance' | 'designParameters' | 'designedConditions' | 'attributes', entries: [string, string][]) {
  const map: Record<string, string> = {};
  for (const [k, v] of entries) map[k] = v;
  const label = `edit subject ${props.elementId} ${family}.${field}`;
  if (family === 'is') patchIs({ [field]: map } as Partial<Subject['is']>, label);
  else patchHas({ [field]: map } as Partial<Subject['has']>, label);
}

const mapEntries = (map: Record<string, string> | undefined): [string, string][] => Object.entries(map ?? {});

/** Dimensions: dimension id → value ids (the `dim in { v1, v2 }` form). */
const dimensionEntries = computed(() => Object.entries(hasFacets.value?.dimensions ?? {}));
function patchDimension(key: string, e: Event) {
  const values = (e.target as HTMLInputElement).value.split(/[\s,]+/).filter(Boolean);
  patchHas({ dimensions: { ...(hasFacets.value?.dimensions ?? {}), [key]: values } }, `edit subject ${props.elementId} dimension ${key}`);
}
const draftDimension = ref('');
function addDimension() {
  const key = draftDimension.value.trim();
  if (!key || (hasFacets.value?.dimensions ?? {})[key]) return;
  patchHas({ dimensions: { ...(hasFacets.value?.dimensions ?? {}), [key]: [] } }, `add subject ${props.elementId} dimension ${key}`);
  draftDimension.value = '';
}
function removeDimension(key: string) {
  const next = { ...(hasFacets.value?.dimensions ?? {}) };
  delete next[key];
  patchHas({ dimensions: next }, `remove subject ${props.elementId} dimension ${key}`);
}

// ── Promises ─────────────────────────────────────────────────────────

function patchPromise(index: number, patch: Partial<SubjectPromise>, label?: string) {
  const next = promises.value.map((p, i) => i === index ? { ...p, ...patch } : p);
  patchIs({ promises: next }, label ?? `edit subject ${props.elementId} promise ${promises.value[index]?.id || index}`);
}

function patchPromiseLevel(index: number, field: string, e: Event) {
  const p = promises.value[index];
  if (!p) return;
  const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
  const current = p.level;
  let level: PromiseLevel;
  if (field === 'kind') {
    if (value === '') level = null;
    else if (value === 'quantity') level = { kind: 'quantity', quantity: { value: current?.kind === 'quantity' ? (current.quantity?.value ?? '') : '', unit: current?.kind === 'quantity' ? current.quantity?.unit : undefined } };
    else if (value === 'range') level = { kind: 'range', min: current?.kind === 'range' ? current.min : undefined, max: current?.kind === 'range' ? current.max : undefined, unit: current?.kind === 'range' ? current.unit : undefined };
    else level = { kind: 'symbolic', symbolic: current?.kind === 'symbolic' ? current.symbolic : '' };
  } else if (current?.kind === 'quantity') {
    level = { ...current, quantity: { ...(current.quantity ?? { value: '' }), [field]: value } };
  } else if (current?.kind === 'range') {
    level = { ...current, [field]: value };
  } else if (current?.kind === 'symbolic') {
    level = { ...current, symbolic: value };
  } else {
    return;
  }
  patchPromise(index, { level }, `edit subject ${props.elementId} promise ${p.id || index} level`);
}

const draftPromise = ref('');
function addPromise() {
  const id = draftPromise.value.trim();
  if (!id || promises.value.some(p => p.id === id)) return;
  patchIs({ promises: [...promises.value, { id, target: '', level: null, conditions: '', statement: '', verifiedBy: [] }] }, `add subject ${props.elementId} promise ${id}`);
  draftPromise.value = '';
}

function removePromise(index: number) {
  patchIs({ promises: promises.value.filter((_, i) => i !== index) }, `remove subject ${props.elementId} promise ${promises.value[index]?.id || index}`);
}

// ── Characteristics ─────────────────────────────────────────────────

function patchCharacteristic(id: string, field: keyof SubjectCharacteristic, e: Event) {
  const current = hasFacets.value?.characteristics ?? {};
  const entry = current[id];
  if (!entry) return;
  patchHas({ characteristics: { ...current, [id]: { ...entry, [field]: (e.target as HTMLInputElement).value } } }, `edit subject ${props.elementId} characteristic ${id}`);
}

const draftCharacteristic = ref('');
function addCharacteristic() {
  const id = draftCharacteristic.value.trim();
  const current = hasFacets.value?.characteristics ?? {};
  if (!id || current[id]) return;
  patchHas({ characteristics: { ...current, [id]: { symbol: '', derivation: '' } } }, `add subject ${props.elementId} characteristic ${id}`);
  draftCharacteristic.value = '';
}

function removeCharacteristic(id: string) {
  const next = { ...(hasFacets.value?.characteristics ?? {}) };
  delete next[id];
  patchHas({ characteristics: next }, `remove subject ${props.elementId} characteristic ${id}`);
}
</script>

<template>
  <div v-if="subject && isFacets && hasFacets" class="subject-inspector" data-testid="subject-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ subject.id }}</code>
    </InspectorField>

    <div v-if="subject.misplacedAspects.length" class="misplaced" data-testid="subject-misplaced">
      parse lint (C6): {{ subject.misplacedAspects.map(mis => `${mis.aspect} under ${mis.family}`).join(', ') }} — misplaced aspect keys never dump; fix in the code view
    </div>

    <InspectorField label="extends" hint="the parent subject id (aspect blocks merge per aspect-kind rules)">
      <input class="text-input mono" :value="subject.extends" data-testid="subject-extends" @change="modelStore.execute(updateConstruct(listOf, props.elementId, { extends: ($event.target as HTMLInputElement).value }, `edit subject ${props.elementId} extends`))" />
    </InspectorField>

    <h4 class="anatomy-head">is — identity &amp; design</h4>

    <InspectorField :label="`metadata (${Object.keys(isFacets.metadata).length})`">
      <KeyValueListEdit :entries="mapEntries(isFacets.metadata)" key-placeholder="name…" value-placeholder="value…" testid-prefix="subject-metadata" @update="patchMap('is', 'metadata', $event)" />
    </InspectorField>

    <InspectorField :label="`provenance (${Object.keys(isFacets.provenance).length})`">
      <KeyValueListEdit :entries="mapEntries(isFacets.provenance)" key-placeholder="manufacturer…" value-placeholder="value…" testid-prefix="subject-provenance" @update="patchMap('is', 'provenance', $event)" />
    </InspectorField>

    <InspectorField :label="`design parameters (${Object.keys(isFacets.designParameters).length})`" hint="type-defining values fixed by design">
      <KeyValueListEdit :entries="mapEntries(isFacets.designParameters)" key-placeholder="e_max…" value-placeholder="500 kg…" testid-prefix="subject-design" @update="patchMap('is', 'designParameters', $event)" />
    </InspectorField>

    <InspectorField :label="`designed conditions (${Object.keys(isFacets.designedConditions).length})`" hint="tier name → condition_set id">
      <KeyValueListEdit :entries="mapEntries(isFacets.designedConditions)" key-placeholder="reference…" value-placeholder="condition set id…" testid-prefix="subject-conditions" @update="patchMap('is', 'designedConditions', $event)" />
    </InspectorField>

    <InspectorField :label="`promises (${promises.length})`" hint="the manufacturer claims — target, level, conditions, statement, verified_by">
      <ul v-if="promises.length" class="promise-rows">
        <li v-for="(p, i) in promises" :key="p.id || i" class="promise-row" :data-testid="`subject-promise-${p.id || i}`">
          <div class="promise-head">
            <code class="promise-id">{{ p.id || '(statement)' }}</code>
            <button type="button" class="row-remove" title="remove promise" :data-testid="`subject-promise-remove-${p.id || i}`" @click="removePromise(i)">✕</button>
          </div>
          <input class="text-input mono" :value="p.target" placeholder="target (a characteristic or behavior id)" :data-testid="`subject-promise-target-${p.id || i}`" @change="patchPromise(i, { target: ($event.target as HTMLInputElement).value })" />
          <div class="level-grid">
            <select class="text-input" :value="p.level?.kind ?? ''" :data-testid="`subject-promise-level-kind-${p.id || i}`" @change="patchPromiseLevel(i, 'kind', $event)">
              <option value="">prose only</option>
              <option value="quantity">quantity</option>
              <option value="range">range</option>
              <option value="symbolic">symbolic</option>
            </select>
            <template v-if="p.level?.kind === 'symbolic'">
              <input class="text-input mono" :value="p.level.symbolic ?? ''" placeholder="level (e.g. C6)" :data-testid="`subject-promise-symbolic-${p.id || i}`" @change="patchPromiseLevel(i, 'symbolic', $event)" />
            </template>
            <template v-else-if="p.level?.kind === 'range'">
              <input class="text-input mono" :value="p.level.min ?? ''" placeholder="min" @change="patchPromiseLevel(i, 'min', $event)" />
              <input class="text-input mono" :value="p.level.max ?? ''" placeholder="max" @change="patchPromiseLevel(i, 'max', $event)" />
              <input class="text-input mono" :value="p.level.unit ?? ''" placeholder="unit" @change="patchPromiseLevel(i, 'unit', $event)" />
            </template>
            <template v-else-if="p.level?.kind === 'quantity'">
              <input class="text-input mono" :value="p.level.quantity?.value ?? ''" placeholder="value" @change="patchPromiseLevel(i, 'value', $event)" />
              <input class="text-input mono" :value="p.level.quantity?.unit ?? ''" placeholder="unit" @change="patchPromiseLevel(i, 'unit', $event)" />
            </template>
          </div>
          <textarea class="text-input" rows="2" :value="p.statement" placeholder="statement" :data-testid="`subject-promise-statement-${p.id || i}`" @change="patchPromise(i, { statement: ($event.target as HTMLTextAreaElement).value })" />
          <input class="text-input mono" :value="p.conditions" placeholder="conditions (OCL over dimensions/conditions; empty = unconditional)" :data-testid="`subject-promise-conditions-${p.id || i}`" @change="patchPromise(i, { conditions: ($event.target as HTMLInputElement).value })" />
          <StringListEdit :items="p.verifiedBy" placeholder="verified by (requirement/test id)…" @update="patchPromise(i, { verifiedBy: $event })" />
        </li>
      </ul>
      <div class="row-add-line">
        <input v-model="draftPromise" class="text-input mono" placeholder="promise id…" data-testid="subject-promise-add" @keyup.enter="addPromise" />
        <button type="button" :disabled="!draftPromise.trim()" data-testid="subject-promise-add-btn" @click="addPromise">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`artifacts (${isFacets.artifacts.length})`" hint="the artifact_definitions this subject must produce">
      <StringListEdit :items="[...isFacets.artifacts]" placeholder="add an artifact definition id…" @update="patchIs({ artifacts: $event }, `edit subject ${props.elementId} artifacts`)" />
    </InspectorField>

    <InspectorField v-if="isFacets.endpoints.length" label="endpoints" hint="the declared API surface — edited in the code view">
      <code class="readonly-id" data-testid="subject-endpoints">{{ isFacets.endpoints.map(ep => ep.id).join(', ') }}</code>
    </InspectorField>

    <h4 class="anatomy-head">has — exhibition</h4>

    <InspectorField :label="`attributes (${Object.keys(hasFacets.attributes).length})`" hint="exhibited named values — name : qualifier">
      <KeyValueListEdit :entries="mapEntries(hasFacets.attributes)" key-placeholder="indication…" value-placeholder="mass test_dependent…" testid-prefix="subject-attr" @update="patchMap('has', 'attributes', $event)" />
    </InspectorField>

    <InspectorField :label="`dimensions (${dimensionEntries.length})`" hint="classification membership — dimension id : value ids (space-separated)">
      <ul v-if="dimensionEntries.length" class="dim-rows">
        <li v-for="[key, values] in dimensionEntries" :key="key" class="dim-row">
          <code class="dim-key">{{ key }}</code>
          <input class="text-input mono" :value="values.join(' ')" :data-testid="`subject-dim-${key}`" @change="patchDimension(key, $event)" />
          <button type="button" class="row-remove" title="remove dimension" :data-testid="`subject-dim-remove-${key}`" @click="removeDimension(key)">✕</button>
        </li>
      </ul>
      <div class="row-add-line">
        <input v-model="draftDimension" class="text-input mono" placeholder="dimension id…" data-testid="subject-dim-add" @keyup.enter="addDimension" />
        <button type="button" :disabled="!draftDimension.trim()" data-testid="subject-dim-add-btn" @click="addDimension">+</button>
      </div>
    </InspectorField>

    <InspectorField label="state machine" hint="the subject's operational state machine (has.state)">
      <input class="text-input mono" :value="hasFacets.state" data-testid="subject-state" @change="patchHas({ state: ($event.target as HTMLInputElement).value }, `edit subject ${props.elementId} state`)" />
    </InspectorField>

    <InspectorField :label="`characteristics (${characteristics.length})`" hint="symbol'd quantities derived from behavior I/O">
      <ul v-if="characteristics.length" class="char-rows">
        <li v-for="c in characteristics" :key="c.id" class="char-row" :data-testid="`subject-char-${c.id}`">
          <div class="char-head">
            <code class="char-id">{{ c.id }}</code>
            <button type="button" class="row-remove" title="remove characteristic" :data-testid="`subject-char-remove-${c.id}`" @click="removeCharacteristic(c.id)">✕</button>
          </div>
          <div class="char-grid">
            <input class="text-input mono" :value="c.symbol" placeholder="symbol" :data-testid="`subject-char-symbol-${c.id}`" @change="patchCharacteristic(c.id, 'symbol', $event)" />
            <input class="text-input mono" :value="c.derivation" placeholder="derivation (ocl{…})" :data-testid="`subject-char-derivation-${c.id}`" @change="patchCharacteristic(c.id, 'derivation', $event)" />
            <input class="text-input mono" :value="c.behavior ?? ''" placeholder="behavior" @change="patchCharacteristic(c.id, 'behavior', $event)" />
            <input class="text-input mono" :value="c.quantityKind ?? ''" placeholder="quantity kind" @change="patchCharacteristic(c.id, 'quantityKind', $event)" />
            <input class="text-input mono" :value="c.unit ?? ''" placeholder="unit" @change="patchCharacteristic(c.id, 'unit', $event)" />
          </div>
        </li>
      </ul>
      <div class="row-add-line">
        <input v-model="draftCharacteristic" class="text-input mono" placeholder="characteristic id…" data-testid="subject-char-add" @keyup.enter="addCharacteristic" />
        <button type="button" :disabled="!draftCharacteristic.trim()" data-testid="subject-char-add-btn" @click="addCharacteristic">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`environmental context (${hasFacets.environmentalContext.length})`">
      <StringListEdit :items="[...hasFacets.environmentalContext]" placeholder="add a logged condition…" @update="patchHas({ environmentalContext: $event }, `edit subject ${props.elementId} environmental context`)" />
    </InspectorField>

    <InspectorField :label="`artifact instances (${hasFacets.artifactInstances.length})`">
      <StringListEdit :items="[...hasFacets.artifactInstances]" placeholder="add an artifact instance id…" @update="patchHas({ artifactInstances: $event }, `edit subject ${props.elementId} artifact instances`)" />
    </InspectorField>

    <InspectorField v-if="hasFacets.serves.length" label="serve bindings" hint="aspect → endpoint bindings with freshness windows — edited in the code view">
      <code class="readonly-id" data-testid="subject-serves">{{ hasFacets.serves.map(sv => sv.aspect).join(', ') }}</code>
    </InspectorField>

    <h4 class="anatomy-head">does — process</h4>

    <InspectorField :label="`behaviors (${subject.does.behaviors.length})`" hint="references to declared behavior constructs">
      <StringListEdit :items="[...subject.does.behaviors]" placeholder="add a behavior id…" @update="patchDoes($event)" />
    </InspectorField>

    <InspectorField :label="`references (${subject.referenceIds.length})`">
      <StringListEdit :items="[...subject.referenceIds]" placeholder="add a reference id…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { referenceIds: items }, `edit subject ${props.elementId} references`))" />
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
.anatomy-head {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border-soft);
}
.misplaced {
  font-size: 0.68rem;
  color: #d49442;
  border: 1px solid #d49442;
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.5rem;
  margin-bottom: 0.6rem;
}
.promise-rows, .char-rows, .dim-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.promise-row, .char-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.promise-head, .char-head { display: flex; justify-content: space-between; align-items: center; }
.promise-id, .char-id { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); }
.level-grid { display: grid; grid-template-columns: 6.5rem 1fr 1fr 1fr; gap: 0.25rem; }
.char-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; }
.dim-row { display: grid; grid-template-columns: 7rem 1fr 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.dim-key { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); }
.row-add-line { display: flex; gap: 0.3rem; }
.row-add-line button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.row-add-line button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
</style>

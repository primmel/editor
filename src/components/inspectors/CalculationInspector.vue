<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The calculation inspector (TODO.editor wave 03) — the calculation
// surface: identity (name, identifier path, category, label), the
// engine rule kind, the typed inputs (name : type { unit, description,
// default, enum_values }), the output, the expression, the table-lookup
// declaration, and the clause provenance (sourceRef / sourceRefs — the
// alias discipline: the serializer walks sourceRefs, so a source patch
// replaces both, keeping the alias intact).
//
// Known kernel gap (pinned in v3-constructs.test.ts): a BARE NUMERIC
// input default mangles on parse (500 → "0") — the parser's
// tokenizer strips it before the editor ever sees the text. The fix is
// upstream (primmel-ts); the field edits the AST facet honestly and a
// reloaded bare-numeric default shows what the kernel kept.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Calculation } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type CalculationInput = Calculation['inputs'][number];
type CalculationOutput = Calculation['output'];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.calculations;
const calc = computed(() => { void modelStore.version; return props.model.calculations.find(c => c.id === props.elementId); });

/** The inputs as a FRESH array per version (the identity-stable list is
 *  mutated in place — a template read off `calc` alone never re-fires). */
const inputs = computed(() => { void modelStore.version; return [...(calc.value?.inputs ?? [])]; });

function patch(field: keyof Calculation, e: Event) {
  if (!calc.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit calculation ${props.elementId}`),
  );
}

function patchInputs(next: CalculationInput[], label: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { inputs: next }, label));
}

function patchInput(index: number, field: keyof CalculationInput, e: Event) {
  const target = e.target as HTMLInputElement | HTMLSelectElement;
  const value = field === 'hasDefault' ? (target as HTMLInputElement).checked : target.value;
  const next = inputs.value.map((inp, i) => {
    if (i !== index) return inp;
    const patched = { ...inp, [field]: value };
    // Unchecking the default clears its value; checking a number-typed
    // input starts at the parser's neutral default.
    if (field === 'hasDefault' && !value) patched.defaultValue = '';
    return patched;
  });
  patchInputs(next, `edit calculation ${props.elementId} input ${inputs.value[index]?.name ?? index}`);
}

function removeInput(index: number) {
  patchInputs(inputs.value.filter((_, i) => i !== index), `remove calculation ${props.elementId} input ${inputs.value[index]?.name ?? index}`);
}

const draftInput = ref('');
function addInput() {
  const name = draftInput.value.trim();
  if (!name || !calc.value || inputs.value.some(i => i.name === name)) return;
  // The parser's own defaults: unit "1" (dimensionless), no default.
  patchInputs([...inputs.value, { name, type: 'number', unit: '1', description: '', defaultValue: '', hasDefault: false }], `add calculation ${props.elementId} input ${name}`);
  draftInput.value = '';
}

function patchOutput(field: keyof CalculationOutput, e: Event) {
  if (!calc.value) return;
  const output = { ...calc.value.output, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value };
  modelStore.execute(updateConstruct(listOf, props.elementId, { output }, `edit calculation ${props.elementId} output`));
}

function patchLookup(field: 'key' | 'variable' | 'multiplier', e: Event) {
  if (!calc.value) return;
  const current = calc.value.lookup ?? { key: '', variable: '', multiplier: '' };
  const lookup = { ...current, [field]: (e.target as HTMLInputElement).value };
  modelStore.execute(updateConstruct(listOf, props.elementId, { lookup }, `edit calculation ${props.elementId} lookup`));
}

function clearLookup() {
  modelStore.execute(updateConstruct(listOf, props.elementId, { lookup: null }, `clear calculation ${props.elementId} lookup`));
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!calc.value) return;
  const sourceRef = { doc: calc.value.sourceRef?.doc ?? '', clause: calc.value.sourceRef?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { sourceRef, sourceRefs: [sourceRef] }, `edit calculation ${props.elementId} source`),
  );
}
</script>

<template>
  <div v-if="calc" class="calculation-inspector" data-testid="calculation-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ calc.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!calc.name">
      <input class="text-input" :value="calc.name" data-testid="calc-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="identifier" hint="the canonical identifier path, e.g. /calc/mpe/absolute">
      <input class="text-input mono" :value="calc.identifier ?? ''" data-testid="calc-identifier" @change="patch('identifier', $event)" />
    </InspectorField>

    <InspectorField label="rule kind" hint="the engine rule (type …): expression | table_lookup | profile_lookup | pass_fail">
      <select class="text-input" :value="calc.ruleType ?? ''" data-testid="calc-rule-type" @change="patch('ruleType', $event)">
        <option value="">—</option>
        <option value="expression">expression</option>
        <option value="table_lookup">table_lookup</option>
        <option value="profile_lookup">profile_lookup</option>
        <option value="pass_fail">pass_fail</option>
      </select>
    </InspectorField>

    <InspectorField label="category">
      <input class="text-input" :value="calc.category ?? ''" data-testid="calc-category" placeholder="metrological" @change="patch('category', $event)" />
    </InspectorField>

    <InspectorField label="description" required :missing="!calc.description">
      <textarea class="text-input" rows="2" :value="calc.description" data-testid="calc-description" @change="patch('description', $event)" />
    </InspectorField>

    <InspectorField :label="`inputs (${inputs.length})`">
      <ul v-if="inputs.length" class="input-rows">
        <li v-for="(inp, i) in inputs" :key="i" class="input-row" :data-testid="`calc-input-${inp.name}`">
          <div class="input-row-head">
            <code class="input-name">{{ inp.name }}</code>
            <select class="text-input input-type" :value="inp.type" :data-testid="`calc-input-type-${inp.name}`" @change="patchInput(i, 'type', $event)">
              <option value="number">number</option>
              <option value="integer">integer</option>
              <option value="string">string</option>
              <option value="boolean">boolean</option>
              <option value="enum">enum</option>
            </select>
            <button type="button" class="row-remove" title="remove input" :data-testid="`calc-input-remove-${inp.name}`" @click="removeInput(i)">✕</button>
          </div>
          <div class="input-row-grid">
            <input class="text-input mono" :value="inp.unit" placeholder="unit" title="unit" :data-testid="`calc-input-unit-${inp.name}`" @change="patchInput(i, 'unit', $event)" />
            <input class="text-input" :value="inp.description" placeholder="description" :data-testid="`calc-input-desc-${inp.name}`" @change="patchInput(i, 'description', $event)" />
          </div>
          <div class="input-row-grid">
            <label class="default-flag">
              <input type="checkbox" :checked="inp.hasDefault" :data-testid="`calc-input-hasdefault-${inp.name}`" @change="patchInput(i, 'hasDefault', $event)" />
              default
            </label>
            <input
              v-if="inp.hasDefault"
              class="text-input mono"
              :value="inp.defaultValue"
              placeholder="default value"
              title="bare numeric defaults hit a kernel parse gap (500 → 0) — the fix is upstream"
              :data-testid="`calc-input-default-${inp.name}`"
              @change="patchInput(i, 'defaultValue', $event)"
            />
          </div>
          <div v-if="inp.enumValues?.length" class="input-enum">enum values: {{ inp.enumValues.join(' ') }}</div>
        </li>
      </ul>
      <div class="input-add">
        <input v-model="draftInput" class="text-input mono" placeholder="input name…" data-testid="calc-input-add" @keyup.enter="addInput" />
        <button type="button" :disabled="!draftInput.trim()" data-testid="calc-input-add-btn" @click="addInput">+</button>
      </div>
    </InspectorField>

    <InspectorField label="output">
      <div class="output-grid">
        <select class="text-input" :value="calc.output.type" data-testid="calc-output-type" @change="patchOutput('type', $event)">
          <option value="number">number</option>
          <option value="integer">integer</option>
          <option value="string">string</option>
          <option value="boolean">boolean</option>
          <option value="enum">enum</option>
        </select>
        <input class="text-input mono" :value="calc.output.unit" placeholder="unit" data-testid="calc-output-unit" @change="patchOutput('unit', $event)" />
        <input class="text-input mono" :value="calc.output.name ?? ''" placeholder="output name" data-testid="calc-output-name" @change="patchOutput('name', $event)" />
        <input class="text-input" :value="calc.output.description ?? ''" placeholder="description" data-testid="calc-output-desc" @change="patchOutput('description', $event)" />
      </div>
    </InspectorField>

    <InspectorField label="expression" required :missing="!calc.expression">
      <textarea class="text-input mono" rows="3" :value="calc.expression" data-testid="calc-expression" @change="patch('expression', $event)" />
    </InspectorField>

    <InspectorField v-if="calc.lookup" label="table lookup" hint="key + carried variable + multiplier">
      <div class="output-grid">
        <input class="text-input mono" :value="calc.lookup.key" placeholder="key" data-testid="calc-lookup-key" @change="patchLookup('key', $event)" />
        <input class="text-input mono" :value="calc.lookup.variable" placeholder="variable" data-testid="calc-lookup-variable" @change="patchLookup('variable', $event)" />
        <input class="text-input mono" :value="calc.lookup.multiplier" placeholder="multiplier" data-testid="calc-lookup-multiplier" @change="patchLookup('multiplier', $event)" />
      </div>
      <div v-if="calc.lookup.defaultTier" class="lookup-tier">
        default tier: ×{{ calc.lookup.defaultTier.factor }} ({{ calc.lookup.defaultTier.mode ?? 'absolute' }}) — edited in the code view
      </div>
      <button type="button" class="lookup-clear" data-testid="calc-lookup-clear" @click="clearLookup">remove lookup</button>
    </InspectorField>

    <InspectorField :label="`parameters (${calc.params?.length ?? 0})`" hint="the parameter ids this calculation is parameterized by">
      <StringListEdit :items="calc.params ?? []" placeholder="add a parameter id…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { params: items }, `edit calculation ${props.elementId} params`))" />
    </InspectorField>

    <InspectorField label="source document" hint="the provenance facet — e.g. urn:oiml:pub:r:60-3:2021">
      <input class="text-input mono" :value="calc.sourceRef?.doc ?? ''" data-testid="calc-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="calc.sourceRef?.clause ?? ''" data-testid="calc-source-clause" @change="patchSource('clause', $event)" />
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
.input-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.input-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
}
.input-row-head { display: grid; grid-template-columns: 1fr 6rem 18px; gap: 0.3rem; align-items: center; }
.input-name { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); }
.input-row-grid { display: grid; grid-template-columns: 5rem 1fr; gap: 0.3rem; margin-top: 0.25rem; align-items: center; }
.input-enum { font-size: 0.62rem; color: var(--text-faint); margin-top: 0.2rem; font-family: var(--font-mono); }
.default-flag { display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: var(--text-muted); }
.row-remove {
  border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem;
}
.row-remove:hover { color: #b85555; }
.input-add { display: flex; gap: 0.3rem; }
.input-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.input-add button:disabled { opacity: 0.4; cursor: default; }
.output-grid { display: grid; grid-template-columns: 6rem 5rem 1fr; gap: 0.3rem; margin-bottom: 0.3rem; }
.lookup-tier { font-size: 0.65rem; color: var(--text-faint); font-family: var(--font-mono); margin-top: 0.2rem; }
.lookup-clear {
  margin-top: 0.3rem; border: 1px solid var(--border); background: var(--bg); color: var(--text-muted);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.65rem; padding: 0.15rem 0.5rem;
}
.lookup-clear:hover { color: #b85555; border-color: #b85555; }
</style>

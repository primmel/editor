<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The symbol inspector (TODO.editor wave 03, window 2) — the symbol
// surface: name/definition/type/unit, the role facets (kind, quantity
// kind, origin), the links (attribute / calculation / profile), the
// enum values, the editorial notes, the inline formula, the series
// shape (read-only summary), and the structured provenance.
//
// KERNEL GAP (pinned in v3-constructs-2.test.ts): dumpSymbol emits the
// values list BARE (`values A B`) while the parser reads one value per
// `values` keyword — a symbol carrying 2+ values dumps text that does
// not reparse. The list stays editable (the in-session AST is correct;
// the corruption is upstream, primmel-ts), flagged by the hint.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Symbol } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.symbols;
const symbol = computed(() => { void modelStore.version; return props.model.symbols.find(s => s.id === props.elementId); });

function patch(field: keyof Symbol, e: Event) {
  if (!symbol.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit symbol ${props.elementId}`),
  );
}

function patchList(field: 'values' | 'notes', items: string[]) {
  if (!symbol.value) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: items }, `edit symbol ${props.elementId} ${field}`));
}

function patchSourceRef(field: 'doc' | 'clause', e: Event) {
  if (!symbol.value) return;
  const sourceRef = {
    doc: symbol.value.sourceRef?.doc ?? '',
    clause: symbol.value.sourceRef?.clause ?? '',
    [field]: (e.target as HTMLInputElement).value,
  };
  modelStore.execute(updateConstruct(listOf, props.elementId, { sourceRef }, `edit symbol ${props.elementId} source`));
}

function patchFormula(field: 'display' | 'expression' | 'inputs', value: string | string[]) {
  if (!symbol.value) return;
  const formula = {
    display: symbol.value.formula?.display ?? '',
    expression: symbol.value.formula?.expression ?? '',
    inputs: symbol.value.formula?.inputs ?? [],
    [field]: value,
  };
  modelStore.execute(updateConstruct(listOf, props.elementId, { formula }, `edit symbol ${props.elementId} formula`));
}

function addFormula() {
  modelStore.execute(updateConstruct(listOf, props.elementId, { formula: { display: '', expression: '', inputs: [] } }, `add symbol ${props.elementId} formula`));
}

function removeFormula() {
  modelStore.execute(updateConstruct(listOf, props.elementId, { formula: null }, `remove symbol ${props.elementId} formula`));
}
</script>

<template>
  <div v-if="symbol" class="symbol-inspector" data-testid="symbol-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ symbol.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!symbol.name">
      <input class="text-input" :value="symbol.name" data-testid="symbol-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!symbol.definition">
      <textarea class="text-input" rows="3" :value="symbol.definition" data-testid="symbol-definition" @change="patch('definition', $event)" />
    </InspectorField>

    <InspectorField label="type">
      <select class="text-input" :value="symbol.type" data-testid="symbol-type" @change="patch('type', $event)">
        <option value="number">number</option>
        <option value="integer">integer</option>
        <option value="string">string</option>
        <option value="boolean">boolean</option>
        <option value="enum">enum</option>
        <option value="collection">collection</option>
        <option value="array">array</option>
      </select>
    </InspectorField>

    <InspectorField label="unit" hint="the parse default is 1 (dimensionless) — the dump omits it">
      <input class="text-input mono" :value="symbol.unit" data-testid="symbol-unit" @change="patch('unit', $event)" />
    </InspectorField>

    <InspectorField label="latex">
      <input class="text-input mono" :value="symbol.latex" data-testid="symbol-latex" @change="patch('latex', $event)" />
    </InspectorField>

    <InspectorField label="kind" hint="attribute | formula | observable (free)">
      <input class="text-input" :value="symbol.kind" data-testid="symbol-kind" @change="patch('kind', $event)" />
    </InspectorField>

    <InspectorField label="quantity kind">
      <input class="text-input" :value="symbol.quantityKind" data-testid="symbol-quantity-kind" @change="patch('quantityKind', $event)" />
    </InspectorField>

    <InspectorField label="origin" hint="measured | derived | declared (free)">
      <input class="text-input" :value="symbol.origin" data-testid="symbol-origin" @change="patch('origin', $event)" />
    </InspectorField>

    <InspectorField label="legacy id" hint="the identifier from the source document">
      <input class="text-input mono" :value="symbol.legacyId" data-testid="symbol-legacy-id" @change="patch('legacyId', $event)" />
    </InspectorField>

    <InspectorField label="attribute" hint="the attribute id this symbol is bound to">
      <input class="text-input mono" :value="symbol.attribute" data-testid="symbol-attribute" @change="patch('attribute', $event)" />
    </InspectorField>

    <InspectorField label="calculation" hint="the calculation id deriving this symbol">
      <input class="text-input mono" :value="symbol.calculation" data-testid="symbol-calculation" @change="patch('calculation', $event)" />
    </InspectorField>

    <InspectorField label="profile" hint="the profile name this symbol resolves through">
      <input class="text-input mono" :value="symbol.profile" data-testid="symbol-profile" @change="patch('profile', $event)" />
    </InspectorField>

    <InspectorField :label="`values (${symbol.values.length})`" hint="the enum axis — KERNEL GAP: 2+ values dump bare and do not reparse (the fix is upstream; ≤1 value is safe)">
      <StringListEdit :items="[...symbol.values]" placeholder="add a value…" @update="patchList('values', $event)" />
    </InspectorField>

    <InspectorField :label="`notes (${symbol.notes.length})`">
      <StringListEdit :items="[...symbol.notes]" placeholder="add a note…" @update="patchList('notes', $event)" />
    </InspectorField>

    <InspectorField v-if="symbol.series" label="series" hint="the axes + cell shape — authored in the code view">
      <code class="readonly-id" data-testid="symbol-series">series declared</code>
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="symbol.sourceRef?.doc ?? ''" data-testid="symbol-source-doc" @change="patchSourceRef('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="symbol.sourceRef?.clause ?? ''" data-testid="symbol-source-clause" @change="patchSourceRef('clause', $event)" />
    </InspectorField>

    <InspectorField label="formula" hint="the inline formula (display + executable expression + inputs)">
      <div v-if="symbol.formula" class="formula-block">
        <input class="text-input" :value="symbol.formula.display" placeholder='display (e.g. "e = I − m")' data-testid="symbol-formula-display" @change="patchFormula('display', ($event.target as HTMLInputElement).value)" />
        <input class="text-input mono" :value="symbol.formula.expression" placeholder="expression (ocl{…})" data-testid="symbol-formula-expression" @change="patchFormula('expression', ($event.target as HTMLInputElement).value)" />
        <StringListEdit :items="[...symbol.formula.inputs]" placeholder="add an input…" @update="patchFormula('inputs', $event)" />
        <button type="button" class="formula-remove" data-testid="symbol-formula-remove" @click="removeFormula">remove formula</button>
      </div>
      <button v-else type="button" class="formula-add" data-testid="symbol-formula-add" @click="addFormula">+ formula</button>
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
.formula-block { display: grid; gap: 0.3rem; }
.formula-add, .formula-remove {
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

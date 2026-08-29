<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The verdict inspector (TODO.editor wave 03) — the canonical
// acceptance quantity ("derive once, reference everywhere"): the symbol,
// the behavior chain link, the quantity kind + unit, the derivation
// (ocl{…}) with its declared inputs, the series reduction, the
// acceptance decision summary, and the clause provenance (the
// source/sourceRefs alias discipline).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Verdict } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.verdicts;
const verdict = computed(() => { void modelStore.version; return props.model.verdicts.find(v => v.id === props.elementId); });

function patch(field: keyof Verdict, e: Event) {
  if (!verdict.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit verdict ${props.elementId}`),
  );
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!verdict.value) return;
  const source = { doc: verdict.value.source?.doc ?? '', clause: verdict.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The serializer walks `sourceRefs` (whose [0] ALIASES `source` on
  // load) — patch both, keeping the alias intact.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit verdict ${props.elementId} source`));
}
</script>

<template>
  <div v-if="verdict" class="verdict-inspector" data-testid="verdict-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ verdict.id }}</code>
    </InspectorField>

    <InspectorField label="symbol" hint="the display symbol of the quantity (e.g. C_M)">
      <input class="text-input mono" :value="verdict.symbol ?? ''" data-testid="verdict-symbol" @change="patch('symbol', $event)" />
    </InspectorField>

    <InspectorField label="behavior" hint="the declared behavior this quantity derives from">
      <input class="text-input mono" :value="verdict.behavior ?? ''" data-testid="verdict-behavior" @change="patch('behavior', $event)" />
    </InspectorField>

    <InspectorField label="quantity kind" required :missing="!verdict.quantityKind">
      <input class="text-input" :value="verdict.quantityKind" data-testid="verdict-quantity-kind" @change="patch('quantityKind', $event)" />
    </InspectorField>

    <InspectorField label="unit" hint="empty for dimensionless">
      <input class="text-input mono" :value="verdict.unit" data-testid="verdict-unit" @change="patch('unit', $event)" />
    </InspectorField>

    <InspectorField label="derive" required :missing="!verdict.derive" hint="the single canonical derivation, ocl{…} — every free identifier must appear in inputs">
      <textarea class="text-input mono" rows="3" :value="verdict.derive" data-testid="verdict-derive" @change="patch('derive', $event)" />
    </InspectorField>

    <InspectorField :label="`inputs (${verdict.inputs.length})`" hint="the symbol ids the derivation reads">
      <StringListEdit :items="[...verdict.inputs]" placeholder="add an input symbol…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { inputs: items }, `edit verdict ${props.elementId} inputs`))" />
    </InspectorField>

    <InspectorField label="series reduction" hint="how a series of derived values reduces to one scalar; none for scalar verdicts">
      <select class="text-input" :value="verdict.seriesReduction ?? ''" data-testid="verdict-series-reduction" @change="modelStore.execute(updateConstruct(listOf, props.elementId, { seriesReduction: (($event.target as HTMLSelectElement).value || null) as Verdict['seriesReduction'] }, `edit verdict ${props.elementId} series reduction`))">
        <option value="">—</option>
        <option value="none">none</option>
        <option value="max">max</option>
        <option value="mean">mean</option>
        <option value="worst_case">worst_case</option>
        <option value="max_abs_over_window">max_abs_over_window</option>
      </select>
    </InspectorField>

    <InspectorField v-if="verdict.acceptance" label="acceptance decision" hint="the guarding/criterion/statistics block — edited in the code view">
      <code class="readonly-id" data-testid="verdict-acceptance">{{ verdict.acceptance.rule }} · {{ verdict.acceptance.criterion }}{{ verdict.acceptance.guardBand ? ` · guard ${verdict.acceptance.guardBand.value}` : '' }}</code>
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="verdict.source?.doc ?? ''" data-testid="verdict-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="verdict.source?.clause ?? ''" data-testid="verdict-source-clause" @change="patchSource('clause', $event)" />
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

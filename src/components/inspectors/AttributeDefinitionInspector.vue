<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The attribute-definition inspector (TODO.editor wave 03, window 2) —
// the INV-2 schema layer: an attribute defined ONCE. Symbol link, name,
// definition, the quantity facets (kind / unit / value type), the
// provenance facets (origin / scope / category), the dimension flag,
// the enum link, the IRDI, the derivation, and the clause provenance
// (source/sourceRefs alias discipline — the dump folds it to
// `ref derives-from`).
//
// KERNEL GAPS (pinned in v3-constructs-2.test.ts — 1.8.0, the fixes are
// upstream in primmel-ts): the parser reads `note`, `enum_values` and
// `ref cites` (→ referenceIds) but the dump emits none of them, so an
// edit would silently strip them on save — the wave-00 regression all
// over. All three render READ-ONLY here; author them in the code view.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { AttributeDefinition } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.attributeDefinitions;
const attribute = computed(() => { void modelStore.version; return props.model.attributeDefinitions.find(a => a.id === props.elementId); });

function patch(field: keyof AttributeDefinition, e: Event) {
  if (!attribute.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit attribute definition ${props.elementId}`),
  );
}

function patchDimension(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  const isDimension = v === '' ? null : v === 'true';
  modelStore.execute(updateConstruct(listOf, props.elementId, { isDimension }, `edit attribute definition ${props.elementId} is_dimension`));
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!attribute.value) return;
  const source = { doc: attribute.value.source?.doc ?? '', clause: attribute.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load,
  // folding to `ref derives-from`) — patch both, keeping the alias.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit attribute definition ${props.elementId} source`));
}
</script>

<template>
  <div v-if="attribute" class="attribute-definition-inspector" data-testid="attribute-definition-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ attribute.id }}</code>
    </InspectorField>

    <InspectorField label="symbol" hint="the declared symbol this attribute rides">
      <input class="text-input mono" :value="attribute.symbol" data-testid="ad-symbol" @change="patch('symbol', $event)" />
    </InspectorField>

    <InspectorField label="name" required :missing="!attribute.name">
      <input class="text-input" :value="attribute.name" data-testid="ad-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!attribute.definition">
      <textarea class="text-input" rows="3" :value="attribute.definition" data-testid="ad-definition" @change="patch('definition', $event)" />
    </InspectorField>

    <InspectorField label="quantity kind">
      <input class="text-input" :value="attribute.quantityKind" data-testid="ad-quantity-kind" @change="patch('quantityKind', $event)" />
    </InspectorField>

    <InspectorField label="unit">
      <input class="text-input mono" :value="attribute.unit" data-testid="ad-unit" @change="patch('unit', $event)" />
    </InspectorField>

    <InspectorField label="value type" hint="number | integer | string | boolean | …">
      <input class="text-input" :value="attribute.valueType" data-testid="ad-value-type" @change="patch('valueType', $event)" />
    </InspectorField>

    <InspectorField label="origin" hint="declared | measured | derived (free)">
      <input class="text-input" :value="attribute.origin" data-testid="ad-origin" @change="patch('origin', $event)" />
    </InspectorField>

    <InspectorField label="scope" hint="the chain level the value is stated at: family | group | model | sample">
      <select class="text-input" :value="attribute.scope" data-testid="ad-scope" @change="patch('scope', $event)">
        <option value="">—</option>
        <option value="family">family</option>
        <option value="group">group</option>
        <option value="model">model</option>
        <option value="sample">sample</option>
      </select>
    </InspectorField>

    <InspectorField label="category" hint="e.g. metrological | administrative (free)">
      <input class="text-input" :value="attribute.category" data-testid="ad-category" @change="patch('category', $event)" />
    </InspectorField>

    <InspectorField label="is dimension" hint="the classification-dimension mirror flag">
      <select class="text-input" :value="attribute.isDimension === null ? '' : String(attribute.isDimension)" data-testid="ad-is-dimension" @change="patchDimension">
        <option value="">— undeclared —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </InspectorField>

    <InspectorField label="enum" hint="the enum id the values come from (the `enum` facet)">
      <input class="text-input mono" :value="attribute.enumRef" data-testid="ad-enum" @change="patch('enumRef', $event)" />
    </InspectorField>

    <InspectorField v-if="attribute.enumValues?.length" :label="`inline enum values (${attribute.enumValues.length})`" hint="READ-ONLY: the kernel dump does not emit enum_values — an edit would strip it on save (the fix is upstream; author it in the code view)">
      <code class="readonly-id" data-testid="ad-enum-values">{{ attribute.enumValues.join(' ') }}</code>
    </InspectorField>

    <InspectorField label="irdi" hint="the IEC CDD IRDI (the pre-correspondence registry link)">
      <input class="text-input mono" :value="attribute.irdi" data-testid="ad-irdi" @change="patch('irdi', $event)" />
    </InspectorField>

    <InspectorField label="derived" hint="the derivation expression (ocl{…})">
      <input class="text-input mono" :value="attribute.derived" data-testid="ad-derived" @change="patch('derived', $event)" />
    </InspectorField>

    <InspectorField v-if="attribute.note" label="note" hint="READ-ONLY: the kernel dump does not emit note — an edit would strip it on save (the fix is upstream; author it in the code view)">
      <code class="readonly-id" data-testid="ad-note">{{ attribute.note }}</code>
    </InspectorField>

    <InspectorField v-if="attribute.referenceIds.length" :label="`references (${attribute.referenceIds.length})`" hint="READ-ONLY: ref cites folds here but the dump does not re-emit it (the fix is upstream)">
      <code class="readonly-id" data-testid="ad-references">{{ attribute.referenceIds.join(', ') }}</code>
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="attribute.source?.doc ?? ''" data-testid="ad-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="attribute.source?.clause ?? ''" data-testid="ad-source-clause" @change="patchSource('clause', $event)" />
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

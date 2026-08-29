<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The instance inspector (TODO.editor wave 03, window 2) — the instance
// plane of the definition/instance duality: the definition link (`of`),
// the chain level (family | group | model | sample), the upward chain
// links, the INV-8 definition-version pins, and the HAS values (own
// attributes, classification dimensions, the sample-scope test
// context). Values edit as QuantityValue rows (value + unit; extra
// facets carry over).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';
import KeyValueListEdit from '../fields/KeyValueListEdit.vue';
import QuantityValueMapEdit from '../fields/QuantityValueMapEdit.vue';

type Instance = Standard['instances'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.instances;
const instance = computed(() => { void modelStore.version; return props.model.instances.find(i => i.id === props.elementId); });

function patch(field: keyof Instance, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Instance>, label ?? `edit instance ${props.elementId}`));
}

function patchScalar(field: 'of' | 'model' | 'group' | 'family', e: Event) {
  patch(field, (e.target as HTMLInputElement).value);
}

function patchHas(field: 'attributes' | 'dimensions' | 'testContext', value: unknown) {
  const inst = instance.value;
  if (!inst) return;
  patch('has', { ...inst.has, [field]: value }, `edit instance ${props.elementId} has.${field}`);
}
</script>

<template>
  <div v-if="instance" class="instance-inspector" data-testid="instance-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ instance.id }}</code>
    </InspectorField>

    <InspectorField label="of" required :missing="!instance.of" hint="the subject/instrument definition this instantiates">
      <input class="text-input mono" :value="instance.of" data-testid="inst-of" @change="patchScalar('of', $event)" />
    </InspectorField>

    <InspectorField label="level" hint="the subject-chain level">
      <select class="text-input" :value="instance.level" data-testid="inst-level" @change="patch('level', ($event.target as HTMLSelectElement).value)">
        <option value="">—</option>
        <option value="family">family</option>
        <option value="group">group</option>
        <option value="model">model</option>
        <option value="sample">sample</option>
      </select>
    </InspectorField>

    <InspectorField label="chain links" hint="the upward links: sample → model → group → family (instance ids)">
      <div class="chain-grid">
        <input class="text-input mono" :value="instance.model" placeholder="model" data-testid="inst-model" @change="patchScalar('model', $event)" />
        <input class="text-input mono" :value="instance.group" placeholder="group" data-testid="inst-group" @change="patchScalar('group', $event)" />
        <input class="text-input mono" :value="instance.family" placeholder="family" data-testid="inst-family" @change="patchScalar('family', $event)" />
      </div>
    </InspectorField>

    <InspectorField :label="`definition versions (${Object.keys(instance.definitionVersions).length})`" hint="INV-8 — every instance pins its definitions (id → version)">
      <KeyValueListEdit
        :entries="Object.entries(instance.definitionVersions)"
        key-placeholder="definition id…"
        value-placeholder="version…"
        testid-prefix="inst-versions"
        @update="(entries) => patch('definitionVersions', Object.fromEntries(entries), `edit instance ${props.elementId} definition_versions`)"
      />
    </InspectorField>

    <InspectorField :label="`attributes (${Object.keys(instance.has.attributes).length})`" hint="own exhibited values (the parameters plane)">
      <QuantityValueMapEdit :entries="instance.has.attributes" testid-prefix="inst-attrs" @update="(v) => patchHas('attributes', v)" />
    </InspectorField>

    <InspectorField :label="`dimensions (${Object.keys(instance.has.dimensions).length})`" hint="classification membership (never on samples)">
      <KeyValueListEdit
        :entries="Object.entries(instance.has.dimensions)"
        key-placeholder="dimension id…"
        value-placeholder="value id…"
        testid-prefix="inst-dims"
        @update="(entries) => patchHas('dimensions', Object.fromEntries(entries))"
      />
    </InspectorField>

    <InspectorField :label="`test context (${Object.keys(instance.has.testContext).length})`" hint="sample-scope values — never inherited">
      <QuantityValueMapEdit :entries="instance.has.testContext" testid-prefix="inst-test-context" @update="(v) => patchHas('testContext', v)" />
    </InspectorField>

    <InspectorField :label="`references (${instance.referenceIds.length})`">
      <StringListEdit :items="[...instance.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit instance ${props.elementId} references`)" />
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
.chain-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.3rem; }
</style>

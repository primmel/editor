<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The condition set inspector (TODO.editor wave 03) — one operating-
// condition tier (reference | rated | limiting): the role, the subject
// it applies to, and the entries keyed on quantity kind (value, unit,
// tolerance, note), with the clause provenance.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { ConditionSet } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type ConditionEntry = ConditionSet['entries'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.conditionSets;
const cs = computed(() => { void modelStore.version; return props.model.conditionSets.find(c => c.id === props.elementId); });

const entries = computed(() => { void modelStore.version; return (cs.value?.entries ?? []).map(e => ({ ...e })); });

function patch(field: keyof ConditionSet, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<ConditionSet>, label ?? `edit condition set ${props.elementId}`));
}

function patchText(field: 'role' | 'subject' | 'description', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchEntry(index: number, field: keyof ConditionEntry, e: Event) {
  const next = entries.value.map((en, i) => i === index ? { ...en, [field]: (e.target as HTMLInputElement).value } : en);
  patch('entries', next, `edit condition set ${props.elementId} entry ${entries.value[index]?.quantityKind ?? index}`);
}

const draftEntry = ref('');
function addEntry() {
  const kind = draftEntry.value.trim();
  if (!kind || entries.value.some(en => en.quantityKind === kind)) return;
  patch('entries', [...entries.value, { quantityKind: kind, value: '', unit: '', tolerance: '' }], `add condition set ${props.elementId} entry ${kind}`);
  draftEntry.value = '';
}

function removeEntry(index: number) {
  patch('entries', entries.value.filter((_, i) => i !== index), `remove condition set ${props.elementId} entry ${entries.value[index]?.quantityKind ?? index}`);
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!cs.value) return;
  const source = { doc: cs.value.source?.doc ?? '', clause: cs.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The provenance pair here is source ↔ sources[0] (this collection's
  // plural is `sources`, not `sourceRefs`) — patch both, keeping the
  // alias intact; further citations edit in the code view.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sources: [source, ...(cs.value.sources ?? []).slice(1)] }, `edit condition set ${props.elementId} source`));
}
</script>

<template>
  <div v-if="cs" class="condition-set-inspector" data-testid="condition-set-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ cs.id }}</code>
    </InspectorField>

    <InspectorField label="role" required :missing="!cs.role" hint="reference | rated | limiting — the operating-condition tier">
      <input class="text-input" :value="cs.role" data-testid="cs-role" @change="patchText('role', $event)" />
    </InspectorField>

    <InspectorField label="subject" hint="the subject type the conditions apply to (defaults to the instrument)">
      <input class="text-input mono" :value="cs.subject ?? ''" data-testid="cs-subject" @change="patchText('subject', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="cs.description ?? ''" data-testid="cs-description" @change="patchText('description', $event)" />
    </InspectorField>

    <InspectorField :label="`entries (${entries.length})`" hint="keyed on the quantity kind (temperature, power_voltage…)">
      <ul v-if="entries.length" class="entry-rows">
        <li v-for="(en, i) in entries" :key="en.quantityKind" class="entry-row" :data-testid="`cs-entry-${en.quantityKind}`">
          <div class="entry-head">
            <code class="entry-kind">{{ en.quantityKind }}</code>
            <button type="button" class="row-remove" title="remove entry" :data-testid="`cs-entry-remove-${en.quantityKind}`" @click="removeEntry(i)">✕</button>
          </div>
          <div class="entry-grid">
            <input class="text-input mono" :value="en.value" placeholder="value" :data-testid="`cs-entry-value-${en.quantityKind}`" @change="patchEntry(i, 'value', $event)" />
            <input class="text-input mono" :value="en.unit" placeholder="unit" @change="patchEntry(i, 'unit', $event)" />
            <input class="text-input mono" :value="en.tolerance" placeholder="tolerance" @change="patchEntry(i, 'tolerance', $event)" />
          </div>
          <input class="text-input" :value="en.note ?? ''" placeholder="note (provenance/usage)" @change="patchEntry(i, 'note', $event)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftEntry" class="text-input mono" placeholder="quantity kind…" data-testid="cs-entry-add" @keyup.enter="addEntry" />
        <button type="button" :disabled="!draftEntry.trim()" data-testid="cs-entry-add-btn" @click="addEntry">+</button>
      </div>
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="cs.source?.doc ?? ''" data-testid="cs-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="cs.source?.clause ?? ''" data-testid="cs-source-clause" @change="patchSource('clause', $event)" />
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
.entry-head { display: flex; justify-content: space-between; align-items: center; }
.entry-kind { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); }
.entry-grid { display: grid; grid-template-columns: 1fr 4rem 4.5rem; gap: 0.25rem; }
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.entry-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
</style>

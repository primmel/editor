<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The conformance-class inspector (TODO.editor wave 03, window 2) — a
// conformance-test scope (/conf/<area>): the target requirement scope,
// the subject, the applicability filter (dimension → values, with the
// declared-condition match mode), the structured test-subject pairs,
// guidance, and the dependencies. The mapping form of an applicability
// entry summarizes read-only (the code view edits it).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { ConformanceClass } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';
import KeyValueListEdit from '../fields/KeyValueListEdit.vue';

type ApplicabilityEntry = ConformanceClass['applicability'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.conformanceClasses;
const cc = computed(() => { void modelStore.version; return props.model.conformanceClasses.find(c => c.id === props.elementId); });

const applicability = computed(() => { void modelStore.version; return (cc.value?.applicability ?? []).map(a => ({ ...a })); });

function patch(field: keyof ConformanceClass, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<ConformanceClass>, label ?? `edit conformance class ${props.elementId}`));
}

function patchScalar(field: 'name' | 'title' | 'description' | 'target' | 'subject' | 'guidance', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchEntry(index: number, field: keyof ApplicabilityEntry, value: unknown) {
  patch('applicability', applicability.value.map((a, i) => i === index ? { ...a, [field]: value } : a), `edit applicability ${props.elementId}[${index}]`);
}

const draftDimension = ref('');
function addEntry() {
  const dimension = draftDimension.value.trim();
  if (!dimension || !cc.value || applicability.value.some(a => a.dimension === dimension)) return;
  patch('applicability', [...applicability.value, { dimension, values: [], mapping: null, match: null }], `add applicability ${dimension}`);
  draftDimension.value = '';
}

function removeEntry(index: number) {
  patch('applicability', applicability.value.filter((_, i) => i !== index), `remove applicability ${applicability.value[index]?.dimension ?? index}`);
}

function patchTestSubject(entries: [string, string][]) {
  patch('testSubject', Object.fromEntries(entries), `edit conformance class ${props.elementId} test_subject`);
}
</script>

<template>
  <div v-if="cc" class="conformance-class-inspector" data-testid="conformance-class-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ cc.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!cc.name">
      <input class="text-input" :value="cc.name" data-testid="cc-name" @change="patchScalar('name', $event)" />
    </InspectorField>

    <InspectorField label="title">
      <input class="text-input" :value="cc.title ?? ''" data-testid="cc-title" @change="patchScalar('title', $event)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="3" :value="cc.description ?? ''" data-testid="cc-description" @change="patchScalar('description', $event)" />
    </InspectorField>

    <InspectorField label="target" required :missing="!cc.target" hint="the requirement scope these tests verify (e.g. /req/metrological)">
      <input class="text-input mono" :value="cc.target" data-testid="cc-target" @change="patchScalar('target', $event)" />
    </InspectorField>

    <InspectorField label="subject" hint="the subject type or classification the tests apply to">
      <input class="text-input mono" :value="cc.subject" data-testid="cc-subject" @change="patchScalar('subject', $event)" />
    </InspectorField>

    <InspectorField :label="`applicability (${applicability.length})`" hint="dimension → allowed values; the match mode (any | all | exact; undeclared = any)">
      <ul v-if="applicability.length" class="entry-rows">
        <li v-for="(a, i) in applicability" :key="i" class="entry-row" :data-testid="`cc-app-${a.dimension}`">
          <div class="entry-line">
            <code class="entry-id">{{ a.dimension }}</code>
            <select class="match-select" :value="a.match ?? ''" :data-testid="`cc-app-match-${a.dimension}`" @change="patchEntry(i, 'match', ($event.target as HTMLSelectElement).value || null)">
              <option value="">— undeclared —</option>
              <option value="any">any</option>
              <option value="all">all</option>
              <option value="exact">exact</option>
            </select>
            <button type="button" class="row-remove" title="remove entry" :data-testid="`cc-app-remove-${a.dimension}`" @click="removeEntry(i)">✕</button>
          </div>
          <div v-if="a.mapping" class="mapping-note" :data-testid="`cc-app-mapping-${a.dimension}`">
            mapping: {{ Object.entries(a.mapping).map(([k, v]) => `${k}: ${v}`).join(', ') }} — edited in the code view
          </div>
          <StringListEdit v-else :items="[...a.values]" placeholder="add a value…" @update="(items) => patchEntry(i, 'values', items)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftDimension" class="text-input mono" placeholder="dimension id…" data-testid="cc-app-add" @keyup.enter="addEntry" />
        <button type="button" :disabled="!draftDimension.trim()" data-testid="cc-app-add-btn" @click="addEntry">+</button>
      </div>
    </InspectorField>

    <InspectorField v-if="cc.testSubject" :label="`test subject (${Object.keys(cc.testSubject).length})`" hint="the structured subject-of-test description">
      <KeyValueListEdit :entries="Object.entries(cc.testSubject)" testid-prefix="cc-test-subject" @update="patchTestSubject" />
    </InspectorField>

    <InspectorField label="guidance">
      <textarea class="text-input" rows="2" :value="cc.guidance" data-testid="cc-guidance" @change="patchScalar('guidance', $event)" />
    </InspectorField>

    <InspectorField :label="`dependencies (${cc.dependencies.length})`">
      <StringListEdit :items="[...cc.dependencies]" placeholder="add a class id…" @update="(items) => patch('dependencies', items, `edit conformance class ${props.elementId} dependencies`)" />
    </InspectorField>

    <InspectorField :label="`references (${cc.referenceIds.length})`">
      <StringListEdit :items="[...cc.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit conformance class ${props.elementId} references`)" />
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
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.entry-add button:disabled { opacity: 0.4; cursor: default; }
.match-select {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.68rem;
  padding: 0.1rem 0.3rem;
}
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.mapping-note { font-size: 0.65rem; color: var(--text-faint); font-style: italic; }
</style>

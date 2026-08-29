<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The test sequence inspector (TODO.editor wave 03) — the required test
// ordering of a Recommendation: the ordered steps (test XOR phase, the
// baseline | follow_up role, the depends_on chain), the sample
// applicability, and the clause-URN provenance (repeated source blocks
// — sourceRefs is the only carrier here; there is no `source` alias).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { TestSequence } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type Step = TestSequence['steps'][number];
type SourceRef = TestSequence['sourceRefs'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.testSequences;
const seq = computed(() => { void modelStore.version; return props.model.testSequences.find(s => s.id === props.elementId); });

const steps = computed(() => { void modelStore.version; return (seq.value?.steps ?? []).map(s => ({ ...s })); });
const sourceRefs = computed(() => { void modelStore.version; return (seq.value?.sourceRefs ?? []).map(s => ({ ...s })); });

function patch(field: keyof TestSequence, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<TestSequence>, label ?? `edit test sequence ${props.elementId}`));
}

function patchText(field: 'name' | 'description' | 'sampleApplicability', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function patchStep(index: number, field: keyof Step, e: Event) {
  const raw = (e.target as HTMLInputElement | HTMLSelectElement).value;
  const value = field === 'order' || field === 'dependsOn'
    ? (raw === '' ? null : Number(raw))
    : raw;
  const next = steps.value.map((s, i) => i === index ? { ...s, [field]: value } : s);
  patch('steps', next, `edit test sequence ${props.elementId} step ${steps.value[index]?.order ?? index}`);
}

function addStep() {
  const nextOrder = steps.value.reduce((m, s) => Math.max(m, s.order ?? 0), 0) + 1;
  patch('steps', [...steps.value, { order: nextOrder, test: '', phase: '', role: '', dependsOn: null }], `add test sequence ${props.elementId} step ${nextOrder}`);
}

function removeStep(index: number) {
  patch('steps', steps.value.filter((_, i) => i !== index), `remove test sequence ${props.elementId} step ${steps.value[index]?.order ?? index}`);
}

function patchSource(index: number, field: 'doc' | 'clause', e: Event) {
  const next = sourceRefs.value.map((s, i) => i === index ? { ...s, [field]: (e.target as HTMLInputElement).value } : s);
  patch('sourceRefs', next, `edit test sequence ${props.elementId} source ${index}`);
}

function addSource() {
  patch('sourceRefs', [...sourceRefs.value, { doc: '', clause: '' }], `add test sequence ${props.elementId} source`);
}

function removeSource(index: number) {
  patch('sourceRefs', sourceRefs.value.filter((_, i) => i !== index), `remove test sequence ${props.elementId} source ${index}`);
}
</script>

<template>
  <div v-if="seq" class="test-sequence-inspector" data-testid="test-sequence-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ seq.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!seq.name">
      <input class="text-input" :value="seq.name" data-testid="seq-name" @change="patchText('name', $event)" />
    </InspectorField>

    <InspectorField label="description" required :missing="!seq.description" hint="what the ordering protects">
      <textarea class="text-input" rows="3" :value="seq.description" data-testid="seq-description" @change="patchText('description', $event)" />
    </InspectorField>

    <InspectorField :label="`steps (${steps.length})`" hint="test XOR phase per step; role is baseline | follow_up (test steps only); depends_on names an earlier step's order">
      <ul v-if="steps.length" class="step-rows">
        <li v-for="(s, i) in steps" :key="i" class="step-row" :data-testid="`seq-step-${s.order ?? i}`">
          <div class="step-head">
            <input class="text-input mono step-order" type="number" min="1" :value="s.order ?? ''" :data-testid="`seq-step-order-${i}`" @change="patchStep(i, 'order', $event)" />
            <select class="text-input step-role" :value="s.role" :data-testid="`seq-step-role-${i}`" @change="patchStep(i, 'role', $event)">
              <option value="">— role —</option>
              <option value="baseline">baseline</option>
              <option value="follow_up">follow_up</option>
            </select>
            <input class="text-input mono step-depends" type="number" min="1" :value="s.dependsOn ?? ''" placeholder="deps" title="depends_on (an earlier step's order)" :data-testid="`seq-step-depends-${i}`" @change="patchStep(i, 'dependsOn', $event)" />
            <button type="button" class="row-remove" title="remove step" :data-testid="`seq-step-remove-${i}`" @click="removeStep(i)">✕</button>
          </div>
          <input class="text-input mono" :value="s.test" placeholder="test (a conformance-test reference)" :data-testid="`seq-step-test-${i}`" @change="patchStep(i, 'test', $event)" />
          <input v-if="!s.test" class="text-input mono" :value="s.phase" placeholder="phase (an environment-program phase)" :data-testid="`seq-step-phase-${i}`" @change="patchStep(i, 'phase', $event)" />
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="seq-step-add" @click="addStep">+ step</button>
    </InspectorField>

    <InspectorField label="sample applicability" hint="which samples the sequence binds (free vocabulary — the smart side owns the semantics)">
      <input class="text-input" :value="seq.sampleApplicability" data-testid="seq-sample-applicability" @change="patchText('sampleApplicability', $event)" />
    </InspectorField>

    <InspectorField :label="`sources (${sourceRefs.length})`" hint="the clause-URN provenance — repeated source blocks">
      <ul v-if="sourceRefs.length" class="source-rows">
        <li v-for="(s, i) in sourceRefs" :key="i" class="source-row">
          <input class="text-input mono" :value="s.doc" placeholder="doc URN" :data-testid="`seq-source-doc-${i}`" @change="patchSource(i, 'doc', $event)" />
          <input class="text-input mono" :value="s.clause" placeholder="clause" :data-testid="`seq-source-clause-${i}`" @change="patchSource(i, 'clause', $event)" />
          <button type="button" class="row-remove" title="remove source" @click="removeSource(i)">✕</button>
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="seq-source-add" @click="addSource">+ source</button>
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
.step-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.step-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.step-head { display: grid; grid-template-columns: 3.5rem 6rem 4rem 18px; gap: 0.3rem; align-items: center; }
.source-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.source-row { display: grid; grid-template-columns: 2fr 1fr 18px; gap: 0.25rem; margin-bottom: 0.25rem; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
}
</style>

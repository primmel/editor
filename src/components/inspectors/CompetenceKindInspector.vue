<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The competence-kind inspector (TODO.editor wave 03, window 2) — one
// laboratory testing-competence kind: label, definition, the normative
// anchor (the source fold), and the method-standard registry (id +
// bibliographic title per entry).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type CompetenceKind = Standard['competenceKinds'][number];
type MethodStandard = CompetenceKind['methodStandards'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.competenceKinds;
const kind = computed(() => { void modelStore.version; return props.model.competenceKinds.find(c => c.id === props.elementId); });

const methodStandards = computed(() => { void modelStore.version; return (kind.value?.methodStandards ?? []).map(m => ({ ...m })); });

function patch(field: keyof CompetenceKind, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<CompetenceKind>, label ?? `edit competence kind ${props.elementId}`));
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const k = kind.value;
  if (!k) return;
  const source = { doc: k.source?.doc ?? '', clause: k.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The dump walks `sourceRefs` (whose [0] ALIASES `source` on load) —
  // patch both in ONE command, keeping the alias.
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit competence kind ${props.elementId} source`));
}

function patchMethod(index: number, field: keyof MethodStandard, e: Event) {
  patch('methodStandards', methodStandards.value.map((m, i) => i === index ? { ...m, [field]: (e.target as HTMLInputElement).value } : m), `edit method standard ${props.elementId}[${index}]`);
}

const draftMethodId = ref('');
function addMethod() {
  const id = draftMethodId.value.trim();
  if (!id || !kind.value || methodStandards.value.some(m => m.id === id)) return;
  patch('methodStandards', [...methodStandards.value, { id, title: '' }], `add method standard ${id}`);
  draftMethodId.value = '';
}

function removeMethod(index: number) {
  patch('methodStandards', methodStandards.value.filter((_, i) => i !== index), `remove method standard ${methodStandards.value[index]?.id ?? index}`);
}
</script>

<template>
  <div v-if="kind" class="competence-kind-inspector" data-testid="competence-kind-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ kind.id }}</code>
    </InspectorField>

    <InspectorField label="label" required :missing="!kind.label">
      <input class="text-input" :value="kind.label" data-testid="ck-label" @change="(e) => patch('label', (e.target as HTMLInputElement).value)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!kind.definition">
      <textarea class="text-input" rows="3" :value="kind.definition" data-testid="ck-definition" @change="(e) => patch('definition', (e.target as HTMLTextAreaElement).value)" />
    </InspectorField>

    <InspectorField :label="`method standards (${methodStandards.length})`" hint="the recognized method-standard ids (e.g. iec-61000-4-4)">
      <ul v-if="methodStandards.length" class="entry-rows">
        <li v-for="(m, i) in methodStandards" :key="i" class="entry-row" :data-testid="`ck-method-${m.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ m.id }}</code>
            <button type="button" class="row-remove" title="remove method standard" :data-testid="`ck-method-remove-${m.id}`" @click="removeMethod(i)">✕</button>
          </div>
          <input class="text-input" :value="m.title" placeholder="bibliographic title" :data-testid="`ck-method-title-${m.id}`" @change="patchMethod(i, 'title', $event)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftMethodId" class="text-input mono" placeholder="standard id…" data-testid="ck-method-add" @keyup.enter="addMethod" />
        <button type="button" :disabled="!draftMethodId.trim()" data-testid="ck-method-add-btn" @click="addMethod">+</button>
      </div>
    </InspectorField>

    <InspectorField label="source document" hint="the normative anchor (ISO/IEC 17025 §6.x, a Recommendation clause)">
      <input class="text-input mono" :value="kind.source?.doc ?? ''" data-testid="ck-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="kind.source?.clause ?? ''" data-testid="ck-source-clause" @change="patchSource('clause', $event)" />
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
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
</style>

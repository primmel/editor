<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The competence-kind inspector (TODO.editor wave 03, window 2) — one
// laboratory testing-competence kind: label, definition, and the
// normative anchor (the source fold). The method edge lives on
// required_competence's method_ref (the process, never a bibliographic
// standard — the owner's ruling the kernel's C168 retirement landed).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type CompetenceKind = Standard['competenceKinds'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.competenceKinds;
const kind = computed(() => { void modelStore.version; return props.model.competenceKinds.find(c => c.id === props.elementId); });

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

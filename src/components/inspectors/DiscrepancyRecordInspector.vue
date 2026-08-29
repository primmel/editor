<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The discrepancy-record inspector (TODO.editor wave 03, window 2) —
// the corpus's errata memory: a documented conflict between source
// fragments. Status (open | resolved), the one-sentence summary, the
// conflicting sources (≥2), the disposition (follows_clause_x names
// the governing source; annotated_only picks no side), and the
// rationale with the deciding authority.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type DiscrepancyRecord = Standard['discrepancyRecords'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.discrepancyRecords;
const record = computed(() => { void modelStore.version; return props.model.discrepancyRecords.find(d => d.id === props.elementId); });

function patch(field: keyof DiscrepancyRecord, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<DiscrepancyRecord>, label ?? `edit discrepancy record ${props.elementId}`));
}

function patchScalar(field: 'summary' | 'resolution' | 'governing' | 'rationale', e: Event) {
  patch(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
}
</script>

<template>
  <div v-if="record" class="discrepancy-record-inspector" data-testid="discrepancy-record-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ record.id }}</code>
    </InspectorField>

    <InspectorField label="status" hint="open (undispositioned) | resolved (the treatment is settled)">
      <select class="text-input" :value="record.status" data-testid="dr-status" @change="(e) => patch('status', (e.target as HTMLSelectElement).value)">
        <option value="">—</option>
        <option value="open">open</option>
        <option value="resolved">resolved</option>
      </select>
    </InspectorField>

    <InspectorField label="summary" required :missing="!record.summary" hint="the one-sentence statement of the contradiction">
      <textarea class="text-input" rows="2" :value="record.summary" data-testid="dr-summary" @change="patchScalar('summary', $event)" />
    </InspectorField>

    <InspectorField :label="`sources (${record.sources.length})`" hint="the conflicting clause/document URNs (≥2 — both sides)">
      <StringListEdit :items="[...record.sources]" placeholder="add a source URN…" @update="(items) => patch('sources', items, `edit discrepancy record ${props.elementId} sources`)" />
    </InspectorField>

    <InspectorField label="resolution" hint="follows_clause_x | annotated_only — empty while open">
      <input class="text-input mono" :value="record.resolution" data-testid="dr-resolution" @change="patchScalar('resolution', $event)" />
    </InspectorField>

    <InspectorField label="governing" hint="the governing source — required iff resolution is follows_clause_x">
      <input class="text-input mono" :value="record.governing" data-testid="dr-governing" @change="patchScalar('governing', $event)" />
    </InspectorField>

    <InspectorField label="rationale" hint="why the corpus treats the conflict this way + the deciding authority">
      <textarea class="text-input" rows="3" :value="record.rationale" data-testid="dr-rationale" @change="patchScalar('rationale', $event)" />
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

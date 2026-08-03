<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The conformance-test inspector (TODO.editor/40, the OIML plugin) —
// the test's identity and provenance surface: name, type, kind,
// guidance, the reference (the clause provenance), the obligation with
// its note, and the acceptance block (type + description + pass-if —
// the raw text, the structured editor is future work).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../../components/fields/InspectorField.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.conformanceTests;
const test = computed(() => { void modelStore.version; return props.model.conformanceTests.find(t => t.id === props.elementId); });

function patch(field: string, e: Event) {
  if (!test.value) return;
  modelStore.execute(
    updateElement(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit conformance test ${props.elementId}`),
  );
}
</script>

<template>
  <div v-if="test" class="conformance-test-inspector" data-testid="conformance-test-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ test.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!test.name">
      <input class="text-input" :value="test.name" data-testid="ct-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="type">
      <input class="text-input" :value="test.type" data-testid="ct-type" @change="patch('type', $event)" />
    </InspectorField>

    <InspectorField label="kind">
      <input class="text-input" :value="test.kind" data-testid="ct-kind" @change="patch('kind', $event)" />
    </InspectorField>

    <InspectorField label="guidance">
      <textarea class="text-input" rows="3" :value="test.guidance" data-testid="ct-guidance" @change="patch('guidance', $event)" />
    </InspectorField>

    <InspectorField label="reference" hint="the provenance — the Recommendation clause the test realizes">
      <input class="text-input" :value="test.reference" data-testid="ct-reference" @change="patch('reference', $event)" />
    </InspectorField>

    <InspectorField label="obligation">
      <select class="text-input" :value="test.obligation" data-testid="ct-obligation" @change="patch('obligation', $event)">
        <option value="">—</option>
        <option value="shall">shall</option>
        <option value="should">should</option>
        <option value="may">may</option>
      </select>
    </InspectorField>

    <InspectorField label="obligation note">
      <input class="text-input" :value="test.obligationNote" data-testid="ct-obligation-note" @change="patch('obligationNote', $event)" />
    </InspectorField>

    <InspectorField label="acceptance criteria type">
      <input class="text-input" :value="test.acceptanceCriteriaType" data-testid="ct-acceptance-type" @change="patch('acceptanceCriteriaType', $event)" />
    </InspectorField>

    <InspectorField label="acceptance criteria" hint="the raw block, verbatim — the structured editor is future work (demo/oiml-cs/AUDIT.md)">
      <textarea class="text-input" rows="4" :value="test.acceptanceCriteriaDescription" data-testid="ct-acceptance-criteria" @change="patch('acceptanceCriteriaDescription', $event)" />
    </InspectorField>

    <InspectorField label="acceptance pass if">
      <textarea class="text-input mono" rows="3" :value="test.acceptancePassIf" data-testid="ct-acceptance-pass-if" @change="patch('acceptancePassIf', $event)" />
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

<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The requirement inspector (TODO.editor/40, the OIML plugin) — the
// scheme requirement's full provenance surface: name, statement,
// guidance, obligation, the source facet (doc + clause), the
// acceptance criteria (the raw block — the structured editor is
// future work, demo/oiml-cs/AUDIT.md), the verification method.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../../components/fields/InspectorField.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.requirements;
const req = computed(() => { void modelStore.version; return props.model.requirements.find(r => r.id === props.elementId); });

function patch(field: string, e: Event) {
  if (!req.value) return;
  modelStore.execute(
    updateElement(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit requirement ${props.elementId}`),
  );
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  if (!req.value) return;
  const source = { doc: req.value.source?.doc ?? '', clause: req.value.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  // The serializer walks `sourceRefs` (whose [0] ALIASES `source` on
  // load) — replacing `source` alone would shadow the edit behind the
  // old aliased object. Patch both, keeping the alias intact.
  modelStore.execute(
    updateElement(listOf, props.elementId, { source, sourceRefs: [source] }, `edit requirement ${props.elementId} source`),
  );
}
</script>

<template>
  <div v-if="req" class="requirement-inspector" data-testid="requirement-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ req.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!req.name">
      <input class="text-input" :value="req.name" data-testid="req-name" @change="patch('name', $event)" />
    </InspectorField>

    <InspectorField label="statement" required :missing="!req.statement">
      <textarea class="text-input" rows="4" :value="req.statement" data-testid="req-statement" @change="patch('statement', $event)" />
    </InspectorField>

    <InspectorField label="guidance">
      <textarea class="text-input" rows="2" :value="req.guidance" data-testid="req-guidance" @change="patch('guidance', $event)" />
    </InspectorField>

    <InspectorField label="obligation">
      <select class="text-input" :value="req.obligation" data-testid="req-obligation" @change="patch('obligation', $event)">
        <option value="shall">shall</option>
        <option value="should">should</option>
        <option value="may">may</option>
      </select>
    </InspectorField>

    <InspectorField label="source document" hint="the provenance facet — e.g. urn:oiml:pub:cs:pd-05:2024 or PD-05 §4.2.1">
      <input class="text-input" :value="req.source?.doc ?? ''" data-testid="req-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input" :value="req.source?.clause ?? ''" data-testid="req-source-clause" @change="patchSource('clause', $event)" />
    </InspectorField>

    <InspectorField label="acceptance criteria" hint="the raw block, verbatim — the structured editor is future work (demo/oiml-cs/AUDIT.md)">
      <textarea class="text-input mono" rows="6" :value="req.acceptanceCriteria" data-testid="req-acceptance-criteria" @change="patch('acceptanceCriteria', $event)" />
    </InspectorField>

    <InspectorField label="verification method">
      <input class="text-input" :value="req.verificationMethod" data-testid="req-verification-method" @change="patch('verificationMethod', $event)" />
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

<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The term inspector (TODO.editor wave 03) — the terminology surface:
// label, definition, the provenance facets (section / source), the
// lexical facets (language, form, part of speech, alt/abbreviation/
// deprecated/see-also designations), the vocabulary-register link, the
// symbol link, and the `overlay` marker.
//
// The overlay marker is READ-ONLY here: the kernel's dumpTerm does not
// emit `overlay true` (the documented 1.6.1→1.8.0 dump gap, pinned by
// term-overlay.test.ts), so an edit would silently strip the marker on
// save — the wave-00 regression all over. It is authored in the code
// view until the kernel dumps it (the fix is upstream, primmel-ts).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Term } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.terms;
const term = computed(() => { void modelStore.version; return props.model.terms.find(t => t.id === props.elementId); });

function patch(field: keyof Term, e: Event) {
  if (!term.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }, `edit term ${props.elementId}`),
  );
}

function patchList(field: 'alt' | 'abbreviations' | 'seeAlso' | 'deprecated' | 'referenceIds', items: string[]) {
  if (!term.value) return;
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: items }, `edit term ${props.elementId} ${field}`));
}

function patchVocabRef(field: 'register' | 'clause', e: Event) {
  if (!term.value) return;
  const vocabRef = {
    register: term.value.vocabRef?.register ?? '',
    clause: term.value.vocabRef?.clause ?? '',
    [field]: (e.target as HTMLInputElement).value,
  };
  modelStore.execute(updateConstruct(listOf, props.elementId, { vocabRef }, `edit term ${props.elementId} vocab_ref`));
}
</script>

<template>
  <div v-if="term" class="term-inspector" data-testid="term-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ term.id }}</code>
    </InspectorField>

    <InspectorField v-if="term.overlay === true" label="overlay" hint="intentionally overrides an upstream package's term of the same id — read-only here: the kernel dump does not emit `overlay true` yet (the fix is upstream; author it in the code view)">
      <code class="readonly-id" data-testid="term-overlay">overlay true</code>
    </InspectorField>

    <InspectorField label="label" required :missing="!term.label">
      <input class="text-input" :value="term.label" data-testid="term-label" @change="patch('label', $event)" />
    </InspectorField>

    <InspectorField label="definition" required :missing="!term.definition">
      <textarea class="text-input" rows="4" :value="term.definition" data-testid="term-definition" @change="patch('definition', $event)" />
    </InspectorField>

    <InspectorField label="section" hint="the clause/section of the source document where the term is defined">
      <input class="text-input" :value="term.section ?? ''" data-testid="term-section" @change="patch('section', $event)" />
    </InspectorField>

    <InspectorField label="source" hint="the source URN(s), plain form — e.g. urn:oiml:pub:r:60-1:2021#clause-3.1.3">
      <input class="text-input mono" :value="term.source ?? ''" data-testid="term-source" @change="patch('source', $event)" />
    </InspectorField>

    <InspectorField label="note">
      <textarea class="text-input" rows="2" :value="term.note ?? ''" data-testid="term-note" @change="patch('note', $event)" />
    </InspectorField>

    <InspectorField label="scope note">
      <input class="text-input" :value="term.scopeNote ?? ''" data-testid="term-scope-note" @change="patch('scopeNote', $event)" />
    </InspectorField>

    <InspectorField label="language">
      <input class="text-input" :value="term.language ?? ''" data-testid="term-language" placeholder="en" @change="patch('language', $event)" />
    </InspectorField>

    <InspectorField label="form type">
      <select class="text-input" :value="term.formType ?? ''" data-testid="term-form-type" @change="patch('formType', $event)">
        <option value="">—</option>
        <option value="fullForm">fullForm</option>
        <option value="abbreviation">abbreviation</option>
        <option value="symbol">symbol</option>
      </select>
    </InspectorField>

    <InspectorField label="part of speech">
      <input class="text-input" :value="term.partOfSpeech ?? ''" data-testid="term-part-of-speech" placeholder="noun" @change="patch('partOfSpeech', $event)" />
    </InspectorField>

    <InspectorField label="symbol" hint="the declared symbol id this term's quantity rides (when it has one)">
      <input class="text-input mono" :value="term.symbolId" data-testid="term-symbol" @change="patch('symbolId', $event)" />
    </InspectorField>

    <InspectorField label="vocabulary register" hint="the glossarist register link (vocab_ref) — register + clause">
      <div class="pair">
        <input class="text-input mono" :value="term.vocabRef?.register ?? ''" placeholder="register (e.g. viml-2022)" data-testid="term-vocab-register" @change="patchVocabRef('register', $event)" />
        <input class="text-input mono" :value="term.vocabRef?.clause ?? ''" placeholder="clause" data-testid="term-vocab-clause" @change="patchVocabRef('clause', $event)" />
      </div>
    </InspectorField>

    <InspectorField v-if="term.vocabRef" label="register's designation" hint="the register's preferred term when it differs from ours">
      <input class="text-input" :value="term.vocabTerm ?? ''" data-testid="term-vocab-term" @change="patch('vocabTerm', $event)" />
    </InspectorField>

    <InspectorField :label="`alternative designations (${term.alt?.length ?? 0})`">
      <StringListEdit :items="term.alt ?? []" placeholder="add an alternative designation…" @update="patchList('alt', $event)" />
    </InspectorField>

    <InspectorField :label="`abbreviations (${term.abbreviations?.length ?? 0})`">
      <StringListEdit :items="term.abbreviations ?? []" placeholder="add an abbreviation…" @update="patchList('abbreviations', $event)" />
    </InspectorField>

    <InspectorField :label="`see also (${term.seeAlso?.length ?? 0})`">
      <StringListEdit :items="term.seeAlso ?? []" placeholder="add a related term id…" @update="patchList('seeAlso', $event)" />
    </InspectorField>

    <InspectorField :label="`deprecated designations (${term.deprecated?.length ?? 0})`">
      <StringListEdit :items="term.deprecated ?? []" placeholder="add a deprecated designation…" @update="patchList('deprecated', $event)" />
    </InspectorField>

    <InspectorField :label="`references (${term.referenceIds.length})`">
      <StringListEdit :items="term.referenceIds" placeholder="add a reference id…" @update="patchList('referenceIds', $event)" />
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
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
</style>

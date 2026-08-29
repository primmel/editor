<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The text inspector (TODO.editor wave 03, window 2) — the ISO 24229
// alternate-spelling blocks: the id addresses a prose field
// (<element-id>.<field>); each entry is one spelling (the code) + the
// value in it + the optional derivation (`via` — a conversion system
// code when the value was derived, not authored). The default
// spelling's value lives inline on the addressed element — an entry
// repeating it is a duplicate (C89).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type TextContent = Standard['texts'][number];
type SpellingEntry = TextContent['entries'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.texts;
const text = computed(() => { void modelStore.version; return props.model.texts.find(t => t.id === props.elementId); });

const entries = computed(() => { void modelStore.version; return (text.value?.entries ?? []).map(e => ({ ...e })); });

function patchEntries(next: SpellingEntry[], label: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { entries: next } as Partial<TextContent>, label));
}

function patchEntry(index: number, field: keyof SpellingEntry, e: Event) {
  const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
  patchEntries(
    entries.value.map((en, i) => {
      if (i !== index) return en;
      const next = { ...en, [field]: value };
      if (field === 'via' && !value) delete next.via;
      return next;
    }),
    `edit text ${props.elementId}[${index}]`,
  );
}

function addEntry() {
  patchEntries([...entries.value, { spelling: '', value: '' }], `add text ${props.elementId} spelling`);
}

function removeEntry(index: number) {
  patchEntries(entries.value.filter((_, i) => i !== index), `remove text ${props.elementId}[${index}]`);
}
</script>

<template>
  <div v-if="text" class="text-inspector" data-testid="text-inspector">
    <InspectorField label="id" hint="the addressed prose field (<element-id>.<field>)">
      <code class="readonly-id">{{ text.id }}</code>
    </InspectorField>

    <InspectorField :label="`spellings (${entries.length})`" hint="one per ISO 24229 spelling-system code; via marks a derived value">
      <ul v-if="entries.length" class="entry-rows">
        <li v-for="(en, i) in entries" :key="i" class="entry-row" :data-testid="`text-entry-${i}`">
          <div class="entry-line">
            <input class="text-input mono spelling-code" :value="en.spelling" placeholder="spelling (de, fr-Latn)" :data-testid="`text-spelling-${i}`" @change="patchEntry(i, 'spelling', $event)" />
            <input class="text-input mono" :value="en.via ?? ''" placeholder="via (conversion system, optional)" :data-testid="`text-via-${i}`" @change="patchEntry(i, 'via', $event)" />
            <button type="button" class="row-remove" title="remove spelling" :data-testid="`text-remove-${i}`" @click="removeEntry(i)">✕</button>
          </div>
          <textarea class="text-input" rows="2" :value="en.value" placeholder="the value in this spelling" :data-testid="`text-value-${i}`" @change="patchEntry(i, 'value', $event)" />
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="text-entry-add" @click="addEntry">+ spelling</button>
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
.entry-line { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 18px; gap: 0.25rem; align-items: center; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
  justify-self: start;
}
</style>

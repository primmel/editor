<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The passport inspector (TODO.editor wave 03, window 2) — the
// model-native DPP projection: the UPI (pattern + ESPR level), the
// data carriers (kind + payload = the endpoint URL), and the
// access-classed content entries (public | restricted | authority ×
// the content classes, with the qualified-ref form). The vocabularies
// come from the kernel's PASSPORT_* constants.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Passport } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

// The passport vocabularies (TODO.editor wave 03, window 2). KERNEL GAP:
// the node build exports PASSPORT_ACCESS_CLASSES / _CONTENT_CLASSES /
// _UPI_LEVELS (1.8.0) but the BROWSER bundle (dist-browser/index.mjs)
// does not re-export them — an upstream packaging gap (the fix is in
// primmel-ts, never worked around semantically). The option lists are
// therefore local constants, pinned EQUAL to the kernel's node-side
// constants by v3-constructs-2.test.ts (the test flips when the kernel
// moves). This file imports them type-side only, never at runtime.
const PASSPORT_ACCESS_CLASSES = ['public', 'restricted', 'authority'] as const;
const PASSPORT_CONTENT_CLASSES = ['identity', 'composition', 'promises_as_verified', 'live_compliance_status', 'artifacts', 'sustainability'] as const;
const PASSPORT_UPI_LEVELS = ['model', 'batch', 'item'] as const;

type PassportCarrier = Passport['carriers'][number];
type PassportContentEntry = Passport['entries'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.passports;
const passport = computed(() => { void modelStore.version; return props.model.passports.find(p => p.id === props.elementId); });

const carriers = computed(() => { void modelStore.version; return (passport.value?.carriers ?? []).map(c => ({ ...c })); });
const entries = computed(() => { void modelStore.version; return (passport.value?.entries ?? []).map(e => ({ ...e })); });

function patch(field: keyof Passport, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Passport>, label ?? `edit passport ${props.elementId}`));
}

function patchUpi(field: 'pattern' | 'level', e: Event) {
  const p = passport.value;
  if (!p) return;
  patch('upi', { ...p.upi, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value }, `edit passport ${props.elementId} upi`);
}

function patchCarrier(index: number, field: keyof PassportCarrier, e: Event) {
  patch('carriers', carriers.value.map((c, i) => i === index ? { ...c, [field]: (e.target as HTMLInputElement).value } : c), `edit carrier ${props.elementId}[${index}]`);
}

function addCarrier() {
  patch('carriers', [...carriers.value, { kind: 'qr', payload: '' }], `add carrier ${props.elementId}`);
}

function removeCarrier(index: number) {
  patch('carriers', carriers.value.filter((_, i) => i !== index), `remove carrier ${props.elementId}[${index}]`);
}

function patchEntry(index: number, field: keyof PassportContentEntry, e: Event) {
  patch('entries', entries.value.map((en, i) => i === index ? { ...en, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value } : en), `edit passport entry ${props.elementId}[${index}]`);
}

const draftAccess = ref<string>('public');
function addEntry() {
  patch('entries', [...entries.value, { access: draftAccess.value, contentClass: 'identity', ref: '' }], `add passport entry ${props.elementId}`);
}

function removeEntry(index: number) {
  patch('entries', entries.value.filter((_, i) => i !== index), `remove passport entry ${props.elementId}[${index}]`);
}
</script>

<template>
  <div v-if="passport" class="passport-inspector" data-testid="passport-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ passport.id }}</code>
    </InspectorField>

    <InspectorField label="upi" hint="the unique product identifier: the pattern + the ESPR level (C88 demands the level)">
      <div class="upi-row">
        <input class="text-input mono" :value="passport.upi.pattern" placeholder="upi:acme:lc500" data-testid="pp-upi-pattern" @change="patchUpi('pattern', $event)" />
        <select class="text-input" :value="passport.upi.level" data-testid="pp-upi-level" @change="patchUpi('level', $event)">
          <option value="">— level —</option>
          <option v-for="l in PASSPORT_UPI_LEVELS" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
    </InspectorField>

    <InspectorField :label="`carriers (${carriers.length})`" hint="the on-product linkage; the payload is the passport endpoint URL">
      <ul v-if="carriers.length" class="entry-rows">
        <li v-for="(c, i) in carriers" :key="i" class="entry-row" :data-testid="`pp-carrier-${i}`">
          <div class="entry-line">
            <input class="text-input mono carrier-kind" :value="c.kind" placeholder="qr | rfid | nfc" :data-testid="`pp-carrier-kind-${i}`" @change="patchCarrier(i, 'kind', $event)" />
            <button type="button" class="row-remove" title="remove carrier" :data-testid="`pp-carrier-remove-${i}`" @click="removeCarrier(i)">✕</button>
          </div>
          <input class="text-input mono" :value="c.payload" placeholder="payload (the endpoint URL)" :data-testid="`pp-carrier-payload-${i}`" @change="patchCarrier(i, 'payload', $event)" />
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="pp-carrier-add" @click="addCarrier">+ carrier</button>
    </InspectorField>

    <InspectorField :label="`content entries (${entries.length})`" hint="<class> or <class>.<ref> under an access class (C86 resolves, C87 leak-checks)">
      <ul v-if="entries.length" class="entry-rows">
        <li v-for="(en, i) in entries" :key="i" class="entry-row" :data-testid="`pp-entry-${i}`">
          <div class="entry-line">
            <select class="text-input" :value="en.access" :data-testid="`pp-entry-access-${i}`" @change="patchEntry(i, 'access', $event)">
              <option v-for="a in PASSPORT_ACCESS_CLASSES" :key="a" :value="a">{{ a }}</option>
            </select>
            <select class="text-input" :value="en.contentClass" :data-testid="`pp-entry-class-${i}`" @change="patchEntry(i, 'contentClass', $event)">
              <option v-for="c in PASSPORT_CONTENT_CLASSES" :key="c" :value="c">{{ c }}</option>
            </select>
            <button type="button" class="row-remove" title="remove entry" :data-testid="`pp-entry-remove-${i}`" @click="removeEntry(i)">✕</button>
          </div>
          <input class="text-input mono" :value="en.ref" placeholder="qualified ref ('' = the whole class)" :data-testid="`pp-entry-ref-${i}`" @change="patchEntry(i, 'ref', $event)" />
        </li>
      </ul>
      <div class="entry-add">
        <select v-model="draftAccess" class="text-input access-draft" data-testid="pp-entry-access-draft">
          <option v-for="a in PASSPORT_ACCESS_CLASSES" :key="a" :value="a">{{ a }}</option>
        </select>
        <button type="button" data-testid="pp-entry-add" @click="addEntry">+</button>
      </div>
    </InspectorField>

    <InspectorField :label="`references (${passport.referenceIds.length})`">
      <StringListEdit :items="[...passport.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit passport ${props.elementId} references`)" />
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
.upi-row { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem; }
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
.entry-line .text-input { flex: 1; }
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.carrier-kind { flex: 1; }
.access-draft { flex: 1; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
  justify-self: start;
}
</style>

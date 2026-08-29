<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The policy inspector (TODO.editor wave 03, window 2) — a policy set:
// name/description, the governed artifact classes, the default-posture
// flag (tri-state — undeclared | true | false), and the rules
// (permission | obligation | prohibition — fail-closed at parse) with
// the governed action, the optional artifact class, and the embedded
// constraint expressions. The provenance folds to ref derives-from.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type Policy = Standard['policies'][number];
type PolicyRule = Policy['rules'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.policies;
const policy = computed(() => { void modelStore.version; return props.model.policies.find(p => p.id === props.elementId); });

const rules = computed(() => { void modelStore.version; return (policy.value?.rules ?? []).map(r => ({ ...r })); });

function patch(field: keyof Policy, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Policy>, label ?? `edit policy ${props.elementId}`));
}

function patchSource(field: 'doc' | 'clause', e: Event) {
  const p = policy.value;
  if (!p) return;
  const source = { doc: p.source?.doc ?? '', clause: p.source?.clause ?? '', [field]: (e.target as HTMLInputElement).value };
  modelStore.execute(updateConstruct(listOf, props.elementId, { source, sourceRefs: [source] }, `edit policy ${props.elementId} source`));
}

function patchPosture(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  patch('defaultPosture', v === '' ? null : v === 'true', `edit policy ${props.elementId} default_posture`);
}

function patchRule(index: number, field: keyof PolicyRule, value: unknown) {
  patch('rules', rules.value.map((r, i) => i === index ? { ...r, [field]: value } : r), `edit rule ${props.elementId}[${index}]`);
}

const draftRuleId = ref('');
function addRule() {
  const id = draftRuleId.value.trim();
  if (!id || !policy.value || rules.value.some(r => r.id === id)) return;
  patch('rules', [...rules.value, { id, kind: 'permission', action: '', artifact: '', constraints: [] }], `add rule ${id}`);
  draftRuleId.value = '';
}

function removeRule(index: number) {
  patch('rules', rules.value.filter((_, i) => i !== index), `remove rule ${rules.value[index]?.id ?? index}`);
}
</script>

<template>
  <div v-if="policy" class="policy-inspector" data-testid="policy-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ policy.id }}</code>
    </InspectorField>

    <InspectorField label="name" required :missing="!policy.name">
      <input class="text-input" :value="policy.name" data-testid="pol-name" @change="(e) => patch('name', (e.target as HTMLInputElement).value)" />
    </InspectorField>

    <InspectorField label="description">
      <textarea class="text-input" rows="2" :value="policy.description" data-testid="pol-description" @change="(e) => patch('description', (e.target as HTMLTextAreaElement).value)" />
    </InspectorField>

    <InspectorField :label="`governs (${policy.governs.length})`" hint="the artifact classes this policy governs (C107 resolves each)">
      <StringListEdit :items="[...policy.governs]" placeholder="add an artifact class id…" @update="(items) => patch('governs', items, `edit policy ${props.elementId} governs`)" />
    </InspectorField>

    <InspectorField label="default posture" hint="a default-posture policy applies to every governed class unless the class overrides it; two defaults never govern the same class (C107)">
      <select class="text-input" :value="policy.defaultPosture === null ? '' : String(policy.defaultPosture)" data-testid="pol-default-posture" @change="patchPosture">
        <option value="">— undeclared —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </InspectorField>

    <InspectorField :label="`rules (${rules.length})`" hint="permission | obligation | prohibition over an action (C107: a rule without its action says nothing)">
      <ul v-if="rules.length" class="entry-rows">
        <li v-for="(r, i) in rules" :key="i" class="entry-row" :data-testid="`pol-rule-${r.id}`">
          <div class="entry-line">
            <code class="entry-id">{{ r.id }}</code>
            <button type="button" class="row-remove" title="remove rule" :data-testid="`pol-rule-remove-${r.id}`" @click="removeRule(i)">✕</button>
          </div>
          <div class="entry-pair">
            <select class="text-input" :value="r.kind" :data-testid="`pol-rule-kind-${r.id}`" @change="patchRule(i, 'kind', ($event.target as HTMLSelectElement).value)">
              <option value="permission">permission</option>
              <option value="obligation">obligation</option>
              <option value="prohibition">prohibition</option>
            </select>
            <input class="text-input mono" :value="r.action" placeholder="action (read, share, retain…)" :data-testid="`pol-rule-action-${r.id}`" @change="patchRule(i, 'action', ($event.target as HTMLInputElement).value)" />
          </div>
          <input class="text-input mono" :value="r.artifact" placeholder="artifact class ('' = every governed class)" :data-testid="`pol-rule-artifact-${r.id}`" @change="patchRule(i, 'artifact', ($event.target as HTMLInputElement).value)" />
          <StringListEdit :items="[...r.constraints]" placeholder="add a constraint (ocl{…})…" @update="(items) => patchRule(i, 'constraints', items)" />
        </li>
      </ul>
      <div class="entry-add">
        <input v-model="draftRuleId" class="text-input mono" placeholder="rule id…" data-testid="pol-rule-add" @keyup.enter="addRule" />
        <button type="button" :disabled="!draftRuleId.trim()" data-testid="pol-rule-add-btn" @click="addRule">+</button>
      </div>
    </InspectorField>

    <InspectorField label="source document">
      <input class="text-input mono" :value="policy.source?.doc ?? ''" data-testid="pol-source-doc" @change="patchSource('doc', $event)" />
    </InspectorField>

    <InspectorField label="source clause">
      <input class="text-input mono" :value="policy.source?.clause ?? ''" data-testid="pol-source-clause" @change="patchSource('clause', $event)" />
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
.entry-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.entry-add { display: flex; gap: 0.3rem; }
.entry-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.entry-add button:disabled { opacity: 0.4; cursor: default; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
</style>

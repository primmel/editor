<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The state machine inspector (TODO.editor wave 03) — states,
// transitions, and the family marker (lifecycle | operational). A state
// rename rewrites every transition endpoint and the initial marker in
// ONE command (the undo is exact). The multi-source transition form
// `[a, b] -> c` arrives EXPANDED (one entry per source) from the parse;
// the dump re-groups, so a guard edit on one entry splits the group —
// honest, and hinted. Cascades summarize read-only (the code view edits
// them).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { StateMachine } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

type Transition = StateMachine['transitions'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.stateMachines;
const machine = computed(() => { void modelStore.version; return props.model.stateMachines.find(s => s.entityName === props.elementId); });

const states = computed(() => { void modelStore.version; return (machine.value?.states ?? []).map(s => s.name); });
const transitions = computed(() => { void modelStore.version; return (machine.value?.transitions ?? []).map(t => ({ ...t })); });

function patch(field: keyof StateMachine, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<StateMachine>, label ?? `edit state machine ${props.elementId}`));
}

function renameState(index: number, e: Event) {
  const m = machine.value;
  if (!m) return;
  const oldName = states.value[index];
  const name = (e.target as HTMLInputElement).value.trim();
  if (!oldName || !name || name === oldName) return;
  if (states.value.includes(name)) return;
  // One command renames the state AND re-points every reference (the
  // initial marker, every transition endpoint) — one undo unit.
  modelStore.execute(updateConstruct(listOf, props.elementId, {
    states: m.states.map((s, i) => i === index ? { name } : s),
    initialState: m.initialState === oldName ? name : m.initialState,
    transitions: m.transitions.map(t => ({
      ...t,
      from: t.from === oldName ? name : t.from,
      to: t.to === oldName ? name : t.to,
    })),
  }, `rename state ${oldName} → ${name}`));
}

const draftState = ref('');
function addState() {
  const name = draftState.value.trim();
  if (!name || !machine.value || states.value.includes(name)) return;
  patch('states', [...machine.value.states, { name }], `add state ${name}`);
  draftState.value = '';
}

function removeState(index: number) {
  const m = machine.value;
  if (!m) return;
  const name = states.value[index];
  // Removing a state drops its transitions and clears an initial marker
  // pointing at it — one command, the whole machine consistent.
  modelStore.execute(updateConstruct(listOf, props.elementId, {
    states: m.states.filter((_, i) => i !== index),
    initialState: m.initialState === name ? '' : m.initialState,
    transitions: m.transitions.filter(t => t.from !== name && t.to !== name),
  }, `remove state ${name}`));
}

function patchTransition(index: number, field: keyof Transition, e: Event) {
  const next = transitions.value.map((t, i) => i === index ? { ...t, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value } : t);
  patch('transitions', next, `edit transition ${props.elementId}[${index}]`);
}

function removeTransition(index: number) {
  patch('transitions', transitions.value.filter((_, i) => i !== index), `remove transition ${props.elementId}[${index}]`);
}

function addTransition() {
  const m = machine.value;
  if (!m) return;
  const first = states.value[0] ?? '';
  patch('transitions', [...transitions.value, { from: first, to: first, actionName: '', guard: '', cascades: [], referenceIds: [] }], `add transition ${props.elementId}`);
}
</script>

<template>
  <div v-if="machine" class="state-machine-inspector" data-testid="state-machine-inspector">
    <InspectorField label="entity">
      <code class="readonly-id">{{ machine.entityName }}</code>
    </InspectorField>

    <InspectorField label="kind" hint="lifecycle (a workflow entity) | operational (a subject's HAS state)">
      <select class="text-input" :value="machine.kind" data-testid="sm-kind" @change="patch('kind', ($event.target as HTMLSelectElement).value)">
        <option value="lifecycle">lifecycle</option>
        <option value="operational">operational</option>
      </select>
    </InspectorField>

    <InspectorField :label="`states (${states.length})`">
      <ul v-if="states.length" class="state-rows">
        <li v-for="(name, i) in states" :key="i" class="state-row">
          <span v-if="name === machine.initialState" class="initial-dot" title="initial state">●</span>
          <span v-else class="initial-dot off"></span>
          <input class="text-input mono" :value="name" :data-testid="`sm-state-${name}`" @change="renameState(i, $event)" />
          <button type="button" class="row-remove" title="remove state" :data-testid="`sm-state-remove-${name}`" @click="removeState(i)">✕</button>
        </li>
      </ul>
      <div class="state-add">
        <input v-model="draftState" class="text-input mono" placeholder="state name…" data-testid="sm-state-add" @keyup.enter="addState" />
        <button type="button" :disabled="!draftState.trim()" data-testid="sm-state-add-btn" @click="addState">+</button>
      </div>
    </InspectorField>

    <InspectorField label="initial state">
      <select class="text-input" :value="machine.initialState" data-testid="sm-initial" @change="patch('initialState', ($event.target as HTMLSelectElement).value)">
        <option value="">—</option>
        <option v-for="name in states" :key="name" :value="name">{{ name }}</option>
      </select>
    </InspectorField>

    <InspectorField :label="`transitions (${transitions.length})`" hint="the multi-source form [a, b] → c arrives expanded, one entry per source; the dump re-groups">
      <ul v-if="transitions.length" class="transition-rows">
        <li v-for="(t, i) in transitions" :key="i" class="transition-row" :data-testid="`sm-transition-${i}`">
          <div class="transition-line">
            <select class="text-input mono" :value="t.from" :data-testid="`sm-tr-from-${i}`" @change="patchTransition(i, 'from', $event)">
              <option v-for="name in states" :key="name" :value="name">{{ name }}</option>
            </select>
            <span class="arrow">→</span>
            <select class="text-input mono" :value="t.to" :data-testid="`sm-tr-to-${i}`" @change="patchTransition(i, 'to', $event)">
              <option v-for="name in states" :key="name" :value="name">{{ name }}</option>
            </select>
            <button type="button" class="row-remove" title="remove transition" :data-testid="`sm-tr-remove-${i}`" @click="removeTransition(i)">✕</button>
          </div>
          <input class="text-input mono" :value="t.actionName" placeholder="action" :data-testid="`sm-tr-action-${i}`" @change="patchTransition(i, 'actionName', $event)" />
          <textarea v-if="t.guard" class="text-input" rows="2" :value="t.guard" placeholder="guard" :data-testid="`sm-tr-guard-${i}`" @change="patchTransition(i, 'guard', $event)" />
          <input v-else class="text-input" :value="t.guard" placeholder="guard (optional)" :data-testid="`sm-tr-guard-${i}`" @change="patchTransition(i, 'guard', $event)" />
          <div v-if="t.cascades.length" class="cascade-note">{{ t.cascades.length }} cascade(s) — edited in the code view</div>
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="sm-tr-add" @click="addTransition">+ transition</button>
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
.state-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.state-row { display: grid; grid-template-columns: 14px 1fr 18px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.initial-dot { color: var(--accent); font-size: 0.55rem; text-align: center; }
.initial-dot.off { color: transparent; }
.state-add { display: flex; gap: 0.3rem; }
.state-add button {
  width: 26px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer;
}
.state-add button:disabled { opacity: 0.4; cursor: default; }
.transition-rows { list-style: none; margin: 0 0 0.4rem; padding: 0; }
.transition-row {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.4rem;
  margin-bottom: 0.3rem;
  display: grid;
  gap: 0.25rem;
}
.transition-line { display: grid; grid-template-columns: 1fr auto 1fr 18px; gap: 0.3rem; align-items: center; }
.arrow { color: var(--text-faint); font-size: 0.75rem; }
.cascade-note { font-size: 0.62rem; color: var(--text-faint); font-style: italic; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
}
</style>

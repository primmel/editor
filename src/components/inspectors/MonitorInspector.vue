<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The monitor inspector (TODO.editor wave 03, window 2) — a continuous
// compliance process over a subject set: the watched subjects (`over`),
// the trigger clock (timer | signal | change), the evaluate selectors
// (all | applicable_to(<expr>) | the refs block), the emit sinks
// (evidence | verdicts → a sink), and the escalation rules (on
// <outcome> { actions } — notify carries the role). §14.12: a monitor
// without a fail escalation is a linter warning (C68).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { Monitor } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

type MonitorTrigger = Monitor['triggers'][number];
type MonitorRefSet = Monitor['evaluate']['requirements'];
type MonitorEmitSink = Monitor['emit'][number];
type MonitorEscalationRule = Monitor['escalate'][number];
type MonitorEscalationAction = MonitorEscalationRule['actions'][number];

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.monitors;
const monitor = computed(() => { void modelStore.version; return props.model.monitors.find(m => m.id === props.elementId); });

const triggers = computed(() => { void modelStore.version; return (monitor.value?.triggers ?? []).map(t => ({ ...t })); });
const emitSinks = computed(() => { void modelStore.version; return (monitor.value?.emit ?? []).map(e => ({ ...e })); });
const escalate = computed(() => { void modelStore.version; return (monitor.value?.escalate ?? []).map(r => ({ ...r, actions: r.actions.map(a => ({ ...a })) })); });

function patch(field: keyof Monitor, value: unknown, label?: string) {
  modelStore.execute(updateConstruct(listOf, props.elementId, { [field]: value } as Partial<Monitor>, label ?? `edit monitor ${props.elementId}`));
}

// ── triggers ─────────────────────────────────────────────────────────
function patchTriggerKind(index: number, kind: string) {
  // Exactly one field is populated per kind (C66) — switching kinds
  // clears the other slots.
  const next: MonitorTrigger = { kind, every: '', signal: '', aspect: '' };
  patch('triggers', triggers.value.map((t, i) => i === index ? next : t), `edit trigger ${props.elementId}[${index}]`);
}

function patchTriggerValue(index: number, e: Event) {
  const t = triggers.value[index];
  if (!t) return;
  const field = t.kind === 'timer' ? 'every' : t.kind === 'signal' ? 'signal' : 'aspect';
  patch('triggers', triggers.value.map((x, i) => i === index ? { ...x, [field]: (e.target as HTMLInputElement).value } : x), `edit trigger ${props.elementId}[${index}]`);
}

function addTrigger() {
  patch('triggers', [...triggers.value, { kind: 'timer', every: '', signal: '', aspect: '' }], `add trigger ${props.elementId}`);
}

function removeTrigger(index: number) {
  patch('triggers', triggers.value.filter((_, i) => i !== index), `remove trigger ${props.elementId}[${index}]`);
}

// ── evaluate selectors ───────────────────────────────────────────────
function patchRefSet(facet: 'requirements' | 'promises', next: MonitorRefSet) {
  const m = monitor.value;
  if (!m) return;
  patch('evaluate', { ...m.evaluate, [facet]: next }, `edit monitor ${props.elementId} evaluate.${facet}`);
}

function patchRefSetKind(facet: 'requirements' | 'promises', kind: string) {
  const current = monitor.value?.evaluate[facet];
  patchRefSet(facet, { kind, expression: current?.expression ?? '', refs: current?.refs ?? [] });
}

function patchRefSetExpression(facet: 'requirements' | 'promises', e: Event) {
  const current = monitor.value?.evaluate[facet];
  patchRefSet(facet, { kind: current?.kind ?? '', expression: (e.target as HTMLInputElement).value, refs: current?.refs ?? [] });
}

function patchRefSetRefs(facet: 'requirements' | 'promises', refs: string[]) {
  const current = monitor.value?.evaluate[facet];
  patchRefSet(facet, { kind: current?.kind ?? '', expression: current?.expression ?? '', refs });
}

// ── emit sinks ───────────────────────────────────────────────────────
function patchSink(index: number, field: keyof MonitorEmitSink, e: Event) {
  patch('emit', emitSinks.value.map((s, i) => i === index ? { ...s, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value } : s), `edit emit ${props.elementId}[${index}]`);
}

function addSink() {
  patch('emit', [...emitSinks.value, { stream: 'evidence', target: '' }], `add emit sink ${props.elementId}`);
}

function removeSink(index: number) {
  patch('emit', emitSinks.value.filter((_, i) => i !== index), `remove emit sink ${props.elementId}[${index}]`);
}

// ── escalation ───────────────────────────────────────────────────────
function patchRuleOutcome(index: number, e: Event) {
  patch('escalate', escalate.value.map((r, i) => i === index ? { ...r, outcome: (e.target as HTMLSelectElement).value } : r), `edit escalation ${props.elementId}[${index}]`);
}

function patchRuleActions(index: number, actions: MonitorEscalationAction[]) {
  patch('escalate', escalate.value.map((r, i) => i === index ? { ...r, actions } : r), `edit escalation ${props.elementId}[${index}] actions`);
}

function addRule() {
  patch('escalate', [...escalate.value, { outcome: 'fail', actions: [] }], `add escalation rule ${props.elementId}`);
}

function removeRule(index: number) {
  patch('escalate', escalate.value.filter((_, i) => i !== index), `remove escalation rule ${props.elementId}[${index}]`);
}

function addAction(ruleIndex: number, action: string) {
  const rule = escalate.value[ruleIndex];
  if (!rule) return;
  patchRuleActions(ruleIndex, [...rule.actions, { action, role: '' }]);
}

function removeAction(ruleIndex: number, actionIndex: number) {
  const rule = escalate.value[ruleIndex];
  if (!rule) return;
  patchRuleActions(ruleIndex, rule.actions.filter((_, i) => i !== actionIndex));
}

function patchActionRole(ruleIndex: number, actionIndex: number, e: Event) {
  const rule = escalate.value[ruleIndex];
  if (!rule) return;
  patchRuleActions(ruleIndex, rule.actions.map((a, i) => i === actionIndex ? { ...a, role: (e.target as HTMLInputElement).value } : a));
}
</script>

<template>
  <div v-if="monitor" class="monitor-inspector" data-testid="monitor-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ monitor.id }}</code>
    </InspectorField>

    <InspectorField :label="`over (${monitor.over.length})`" hint="the monitored subject set (subject ids)">
      <StringListEdit :items="[...monitor.over]" placeholder="add a subject id…" @update="(items) => patch('over', items, `edit monitor ${props.elementId} over`)" />
    </InspectorField>

    <InspectorField :label="`triggers (${triggers.length})`" hint="the clock: every <window> | on signal <name> | on change <aspect>">
      <ul v-if="triggers.length" class="entry-rows">
        <li v-for="(t, i) in triggers" :key="i" class="entry-row" :data-testid="`mon-trigger-${i}`">
          <div class="entry-line">
            <select class="text-input" :value="t.kind" :data-testid="`mon-trigger-kind-${i}`" @change="patchTriggerKind(i, ($event.target as HTMLSelectElement).value)">
              <option value="timer">timer (every)</option>
              <option value="signal">signal</option>
              <option value="change">change</option>
            </select>
            <button type="button" class="row-remove" title="remove trigger" :data-testid="`mon-trigger-remove-${i}`" @click="removeTrigger(i)">✕</button>
          </div>
          <input
            class="text-input mono"
            :value="t.kind === 'timer' ? t.every : t.kind === 'signal' ? t.signal : t.aspect"
            :placeholder="t.kind === 'timer' ? 'window (1h, PT1H)' : t.kind === 'signal' ? 'signal name' : 'aspect path'"
            :data-testid="`mon-trigger-value-${i}`"
            @change="patchTriggerValue(i, $event)"
          />
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="mon-trigger-add" @click="addTrigger">+ trigger</button>
    </InspectorField>

    <InspectorField v-for="facet in (['requirements', 'promises'] as const)" :key="facet" :label="`evaluate ${facet}`" hint="all | applicable_to(<expr>) | the explicit refs">
      <div class="refset" :data-testid="`mon-evaluate-${facet}`">
        <select class="text-input" :value="monitor.evaluate[facet].kind" :data-testid="`mon-evaluate-${facet}-kind`" @change="patchRefSetKind(facet, ($event.target as HTMLSelectElement).value)">
          <option value="">—</option>
          <option value="all">all</option>
          <option value="applicable_to">applicable_to(…)</option>
          <option value="refs">refs { … }</option>
        </select>
        <input
          v-if="monitor.evaluate[facet].kind === 'applicable_to'"
          class="text-input mono"
          :value="monitor.evaluate[facet].expression"
          placeholder="applicability expression (this.classification)"
          :data-testid="`mon-evaluate-${facet}-expression`"
          @change="patchRefSetExpression(facet, $event)"
        />
        <StringListEdit
          v-if="monitor.evaluate[facet].kind === 'refs'"
          :items="[...monitor.evaluate[facet].refs]"
          placeholder="add an id…"
          @update="(items) => patchRefSetRefs(facet, items)"
        />
      </div>
    </InspectorField>

    <InspectorField :label="`emit (${emitSinks.length})`" hint="the fact stream + the verdict log: <stream> -> <sink>">
      <ul v-if="emitSinks.length" class="entry-rows">
        <li v-for="(s, i) in emitSinks" :key="i" class="entry-row" :data-testid="`mon-emit-${i}`">
          <div class="entry-line">
            <select class="text-input" :value="s.stream" :data-testid="`mon-emit-stream-${i}`" @change="patchSink(i, 'stream', $event)">
              <option value="evidence">evidence</option>
              <option value="verdicts">verdicts</option>
            </select>
            <span class="arrow">→</span>
            <input class="text-input mono" :value="s.target" placeholder="sink id (workspace, verdict_log)" :data-testid="`mon-emit-target-${i}`" @change="patchSink(i, 'target', $event)" />
            <button type="button" class="row-remove" title="remove sink" :data-testid="`mon-emit-remove-${i}`" @click="removeSink(i)">✕</button>
          </div>
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="mon-emit-add" @click="addSink">+ sink</button>
    </InspectorField>

    <InspectorField :label="`escalate (${escalate.length})`" hint="on <outcome> { actions } — §14.12: a monitor without a fail path warns (C68)">
      <ul v-if="escalate.length" class="entry-rows">
        <li v-for="(r, i) in escalate" :key="i" class="entry-row" :data-testid="`mon-escalate-${i}`">
          <div class="entry-line">
            <select class="text-input" :value="r.outcome" :data-testid="`mon-escalate-outcome-${i}`" @change="patchRuleOutcome(i, $event)">
              <option value="pass">pass</option>
              <option value="fail">fail</option>
              <option value="indeterminate">indeterminate</option>
              <option value="invalid">invalid</option>
            </select>
            <button type="button" class="row-remove" title="remove rule" :data-testid="`mon-escalate-remove-${i}`" @click="removeRule(i)">✕</button>
          </div>
          <ul v-if="r.actions.length" class="action-rows">
            <li v-for="(a, ai) in r.actions" :key="ai" class="action-row">
              <code class="action-name">{{ a.action }}</code>
              <input v-if="a.action === 'notify'" class="text-input mono" :value="a.role" placeholder="role id" :data-testid="`mon-escalate-role-${i}-${ai}`" @change="patchActionRole(i, ai, $event)" />
              <button type="button" class="row-remove" title="remove action" :data-testid="`mon-escalate-action-remove-${i}-${ai}`" @click="removeAction(i, ai)">✕</button>
            </li>
          </ul>
          <div class="action-add">
            <button type="button" class="row-add" :data-testid="`mon-escalate-notify-${i}`" @click="addAction(i, 'notify')">+ notify</button>
            <button type="button" class="row-add" :data-testid="`mon-escalate-flag-${i}`" @click="addAction(i, 'flag_certificate')">+ flag_certificate</button>
            <button type="button" class="row-add" :data-testid="`mon-escalate-case-${i}`" @click="addAction(i, 'open_service_case')">+ open_service_case</button>
          </div>
        </li>
      </ul>
      <button type="button" class="row-add" data-testid="mon-escalate-add" @click="addRule">+ escalation rule</button>
    </InspectorField>

    <InspectorField :label="`references (${monitor.referenceIds.length})`">
      <StringListEdit :items="[...monitor.referenceIds]" placeholder="add a reference id…" @update="(items) => patch('referenceIds', items, `edit monitor ${props.elementId} references`)" />
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
.entry-line .text-input { flex: 1; }
.refset { display: grid; gap: 0.3rem; }
.action-rows { list-style: none; margin: 0; padding: 0; }
.action-row { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.2rem; }
.action-name { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); }
.action-add { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.arrow { color: var(--text-faint); font-size: 0.75rem; }
.row-remove { border: none; background: none; color: var(--text-faint); cursor: pointer; font-size: 0.65rem; padding: 0.1rem 0.25rem; }
.row-remove:hover { color: #b85555; }
.row-add {
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--accent);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.6rem;
  justify-self: start;
}
</style>

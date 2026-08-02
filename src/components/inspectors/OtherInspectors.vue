<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// Approval / event / gateway / subprocess inspectors (TODO.editor/04).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateElement } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';

const props = defineProps<{
  model: Standard;
  kind: 'approval' | 'event' | 'gateway' | 'subprocess';
  elementId: string;
}>();
const modelStore = useModelStore();

const approval = computed(() => props.model.approvals.find(a => a.id === props.elementId));
const event = computed(() => props.model.events.find(e => e.id === props.elementId));
const gateway = computed(() => props.model.gateways.find(g => g.id === props.elementId));
const page = computed(() => props.model.pages.find(p => p.id === props.elementId));

const roleOptions = computed(() => props.model.roles.map(r => ({ id: r.id, label: r.name || r.id })));
const registryOptions = computed(() => props.model.regs.map(r => r.id));

function patchApproval(p: Record<string, unknown>) {
  modelStore.execute(updateElement((a: Standard) => a.approvals, props.elementId, p as never));
}
function patchEvent(p: Record<string, unknown>) {
  modelStore.execute(updateElement((a: Standard) => a.events, props.elementId, p as never));
}
function patchGateway(p: Record<string, unknown>) {
  modelStore.execute(updateElement((a: Standard) => a.gateways, props.elementId, p as never));
}

// Timer/signal extras live outside the Event type's declared fields —
// read them through a record lens, write them through one handler.
const eventExtra = computed<Record<string, string>>(() =>
  (event.value ?? {}) as unknown as Record<string, string>);

function onEventExtra(key: string, e: Event) {
  patchEvent({ [key]: (e.target as HTMLInputElement).value });
}
</script>

<template>
  <!-- Approval -->
  <div v-if="kind === 'approval' && approval" data-testid="approval-inspector">
    <InspectorField label="id"><code class="readonly-id">{{ approval.id }}</code></InspectorField>
    <InspectorField label="name" required :missing="!approval.name.trim()">
      <input class="text-input" :value="approval.name" data-testid="inspector-name"
        @change="patchApproval({ name: ($event.target as HTMLInputElement).value })" />
    </InspectorField>
    <InspectorField label="actor (applies)" required :missing="!approval.actor">
      <select class="select-input" :value="approval.actor?.id ?? ''" data-testid="inspector-actor"
        @change="patchApproval({ actor: model.roles.find(r => r.id === ($event.target as HTMLSelectElement).value) ?? null })">
        <option value="">— select role —</option>
        <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
      </select>
    </InspectorField>
    <InspectorField label="approver (approves)" required :missing="!approval.approver">
      <select class="select-input" :value="approval.approver?.id ?? ''" data-testid="inspector-approver"
        @change="patchApproval({ approver: model.roles.find(r => r.id === ($event.target as HTMLSelectElement).value) ?? null })">
        <option value="">— select role —</option>
        <option v-for="r in roleOptions" :key="r.id" :value="r.id">{{ r.label }}</option>
      </select>
    </InspectorField>
    <InspectorField label="modality">
      <select class="select-input" :value="approval.modality" data-testid="inspector-modality"
        @change="patchApproval({ modality: ($event.target as HTMLSelectElement).value })">
        <option value="SHALL">SHALL</option>
        <option value="SHOULD">SHOULD</option>
        <option value="MAY">MAY</option>
      </select>
    </InspectorField>
  </div>

  <!-- Event -->
  <div v-else-if="kind === 'event' && event" data-testid="event-inspector">
    <InspectorField label="id"><code class="readonly-id">{{ event.id }}</code></InspectorField>
    <InspectorField label="event type">
      <select class="select-input" :value="event.eventType" data-testid="inspector-event-type"
        @change="patchEvent({ eventType: ($event.target as HTMLSelectElement).value })">
        <option value="start">start</option>
        <option value="end">end</option>
        <option value="timer">timer</option>
        <option value="signalcatch">signalcatch</option>
      </select>
    </InspectorField>
    <InspectorField v-if="event.eventType === 'signalcatch'" label="signal">
      <input class="text-input" :value="eventExtra.signal ?? ''" data-testid="inspector-signal"
        @change="onEventExtra('signal', $event)" />
    </InspectorField>
    <InspectorField v-if="event.eventType === 'timer'" label="timer type">
      <input class="text-input" :value="eventExtra.type ?? ''" placeholder="e.g. cycle"
        @change="onEventExtra('type', $event)" />
    </InspectorField>
    <InspectorField v-if="event.eventType === 'timer'" label="parameter (ISO-8601)">
      <input class="text-input" :value="eventExtra.para ?? ''" placeholder="e.g. P1Y"
        @change="onEventExtra('para', $event)" />
    </InspectorField>
  </div>

  <!-- Gateway -->
  <div v-else-if="kind === 'gateway' && gateway" data-testid="gateway-inspector">
    <InspectorField label="id"><code class="readonly-id">{{ gateway.id }}</code></InspectorField>
    <InspectorField label="gateway type">
      <select class="select-input" :value="gateway.gatewayType" data-testid="inspector-gateway-type"
        @change="patchGateway({ gatewayType: ($event.target as HTMLSelectElement).value })">
        <option value="exclusive_gateway">exclusive</option>
        <option value="parallel_gateway">parallel</option>
      </select>
    </InspectorField>
    <InspectorField label="label">
      <input class="text-input" :value="gateway.label ?? ''" data-testid="inspector-label"
        @change="patchGateway({ label: ($event.target as HTMLInputElement).value })" />
    </InspectorField>
  </div>

  <!-- Subprocess page -->
  <div v-else-if="kind === 'subprocess' && page" data-testid="subprocess-inspector">
    <InspectorField label="id"><code class="readonly-id">{{ page.id }}</code></InspectorField>
    <InspectorField label="elements">
      <span class="readonly-stat">{{ page.childs.length }} nodes · {{ page.edges.length }} edges · {{ (page.data ?? []).length }} data</span>
    </InspectorField>
    <p class="page-hint">Double-click the page's node to edit its contents.</p>
  </div>
</template>

<style scoped>
.readonly-id, .readonly-stat {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.text-input, .select-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
}
.text-input:focus, .select-input:focus {
  outline: none;
  border-color: var(--accent);
}
.page-hint {
  font-size: 0.68rem;
  color: var(--text-faint);
  font-style: italic;
}
</style>

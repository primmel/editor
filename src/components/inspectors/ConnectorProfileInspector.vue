<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The connector-profile inspector (TODO.editor wave 03, window 2) — a
// protocol binding declared per endpoint family: the protocol token,
// the description, references. The four built-in profiles (rest_json,
// mqtt, opc_ua, file_drop) are known to the kernel without declaration
// — the linter's C64 resolves endpoint profiles against declared
// constructs ∪ the built-ins.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { updateConstruct } from '../../lib/commands';
import type { ConnectorProfile } from '../../lib/factory';
import { useModelStore } from '../../stores/model';
import InspectorField from '../fields/InspectorField.vue';
import StringListEdit from '../fields/StringListEdit.vue';

const props = defineProps<{ model: Standard; elementId: string }>();
const modelStore = useModelStore();

const listOf = (a: Standard) => a.connectorProfiles;
const profile = computed(() => { void modelStore.version; return props.model.connectorProfiles.find(c => c.id === props.elementId); });

function patch(field: keyof ConnectorProfile, e: Event) {
  if (!profile.value) return;
  modelStore.execute(
    updateConstruct(listOf, props.elementId, { [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value }, `edit connector profile ${props.elementId}`),
  );
}
</script>

<template>
  <div v-if="profile" class="connector-profile-inspector" data-testid="connector-profile-inspector">
    <InspectorField label="id">
      <code class="readonly-id">{{ profile.id }}</code>
    </InspectorField>

    <InspectorField label="protocol" hint='the bound protocol (free text — "REST/JSON", "MQTT", "OPC-UA")'>
      <input class="text-input" :value="profile.protocol" data-testid="cp-protocol" @change="patch('protocol', $event)" />
    </InspectorField>

    <InspectorField label="description" hint="what the profile carries / how the operation kinds map">
      <textarea class="text-input" rows="3" :value="profile.description" data-testid="cp-description" @change="patch('description', $event)" />
    </InspectorField>

    <InspectorField :label="`references (${profile.referenceIds.length})`">
      <StringListEdit :items="[...profile.referenceIds]" placeholder="add a reference id…" @update="(items) => modelStore.execute(updateConstruct(listOf, props.elementId, { referenceIds: items }, `edit connector profile ${props.elementId} references`))" />
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
</style>

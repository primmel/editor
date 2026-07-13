<script setup lang="ts">
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useUiStore } from '../stores/ui';
import type { SelectionType } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();

interface TreeGroup {
  label: string;
  type: SelectionType;
  items: { id: string; detail?: string }[];
}

const groups = computed<TreeGroup[]>(() => {
  const m = props.model;
  const result: TreeGroup[] = [
    { label: 'Roles', type: 'role', items: m.roles.map((r) => ({ id: r.id, detail: r.name })) },
    { label: 'Processes', type: 'process', items: m.processes.map((p) => ({ id: p.id, detail: p.name })) },
    { label: 'Provisions', type: 'provision', items: m.provisions.map((p) => ({ id: p.id, detail: p.modality })) },
    { label: 'Events', type: 'event', items: m.events.map((e) => ({ id: e.id, detail: e.eventType })) },
    { label: 'Gateways', type: 'gateway', items: m.gateways.map((g) => ({ id: g.id, detail: g.gatewayType })) },
    { label: 'Canvases', type: 'canvas', items: m.pages.map((p) => ({ id: p.id })) },
    { label: 'Data Classes', type: 'dataclass', items: m.dataclasses.map((d) => ({ id: d.id })) },
    { label: 'Registries', type: 'registry', items: m.regs.map((r) => ({ id: r.id })) },
    { label: 'Variables', type: 'measurement', items: m.variables.map((v) => ({ id: v.id })) },
    { label: 'Notes', type: 'reference', items: m.notes.map((n) => ({ id: n.id })) },
  ];
  return result.filter((g) => g.items.length > 0);
});

function selectItem(type: SelectionType, id: string) {
  ui.select(id, type);
  if (type === 'canvas') ui.setCanvas(id);
}
</script>

<template>
  <div class="model-tree">
    <div v-for="group in groups" :key="group.label" class="tree-group">
      <div class="group-header">{{ group.label }} ({{ group.items.length }})</div>
      <ul class="group-items">
        <li
          v-for="item in group.items"
          :key="item.id"
          :class="{ active: ui.isSelected(item.id) }"
          @click="selectItem(group.type, item.id)"
        >
          <span class="item-id">{{ item.id }}</span>
          <span v-if="item.detail" class="item-detail">{{ item.detail }}</span>
        </li>
      </ul>
    </div>
    <div v-if="groups.length === 0" class="tree-empty">Model is empty</div>
  </div>
</template>

<style scoped>
.model-tree { height: 100%; overflow-y: auto; padding: 0.5rem; }
.tree-group { margin-bottom: 0.75rem; }
.group-header {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  margin-bottom: 0.25rem;
  padding: 0 0.25rem;
}
.group-items { list-style: none; padding: 0; margin: 0; }
.group-items li {
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  border-radius: 3px;
  font-size: 0.82rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
}
.group-items li:hover { background: #e8e8e8; }
.group-items li.active { background: var(--accent, #4a6fa5); color: #fff; }
.item-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.8rem; }
.item-detail { font-size: 0.72rem; opacity: 0.7; }
.tree-empty { color: #aaa; font-size: 0.85rem; padding: 1rem; }
</style>

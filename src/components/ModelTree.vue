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
  items: { id: string; detail?: string; children?: string[]; depth?: number }[];
}

const groups = computed<TreeGroup[]>(() => {
  const m = props.model;
  const childSet = new Set<string>();
  for (const p of m.processes) {
    for (const c of p.children ?? []) childSet.add(c);
  }
  const topProcesses = m.processes.filter(p => !p.parent || !childSet.has(p.id) && !p.parent);

  const processItems = topProcesses.map(p => ({
    id: p.id,
    detail: p.name,
    children: p.children ?? [],
    depth: 0,
  }));

  const result: TreeGroup[] = [
    { label: 'Roles', type: 'role', items: m.roles.map((r) => ({ id: r.id, detail: r.name })) },
    { label: 'Processes', type: 'process', items: processItems },
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

function childItems(parentId: string, depth: number): { id: string; detail?: string; depth: number }[] {
  const parent = props.model.processes.find(p => p.id === parentId);
  if (!parent || !parent.children || parent.children.length === 0) return [];
  const items: { id: string; detail?: string; depth: number }[] = [];
  for (const childId of parent.children) {
    const child = props.model.processes.find(p => p.id === childId);
    if (child) {
      items.push({ id: child.id, detail: child.name, depth });
      items.push(...childItems(child.id, depth + 1));
    }
  }
  return items;
}

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
          :style="{ paddingLeft: (0.5 + (item.depth ?? 0) * 1) + 'rem' }"
          @click="selectItem(group.type, item.id)"
        >
          <span v-if="item.depth && item.depth > 0" class="tree-arrow">↳</span>
          <span class="item-id">{{ item.id }}</span>
          <span v-if="item.detail" class="item-detail">{{ item.detail }}</span>
        </li>
        <template v-if="group.type === 'process'">
          <template v-for="parent in group.items" :key="parent.id + '-children'">
            <li
              v-for="child in childItems(parent.id, 1)"
              :key="child.id"
              :class="{ active: ui.isSelected(child.id) }"
              :style="{ paddingLeft: (0.5 + child.depth * 1) + 'rem' }"
              class="child-item"
              @click="selectItem('process', child.id)"
            >
              <span class="tree-arrow">↳</span>
              <span class="item-id">{{ child.id }}</span>
              <span v-if="child.detail" class="item-detail">{{ child.detail }}</span>
            </li>
          </template>
        </template>
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
  align-items: baseline;
  gap: 0.3rem;
}
.group-items li:hover { background: #e8e8e8; }
.group-items li.active { background: var(--accent, #4a6fa5); color: #fff; }
.group-items li.child-item { border-left: 2px solid var(--accent, #4a6fa5); margin-left: 0.5rem; }
.tree-arrow { font-size: 0.7rem; color: #aaa; flex-shrink: 0; }
li.active .tree-arrow { color: rgba(255,255,255,0.7); }
.item-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.8rem; }
.item-detail { font-size: 0.72rem; opacity: 0.7; margin-left: auto; }
.tree-empty { color: #aaa; font-size: 0.85rem; padding: 1rem; }
</style>

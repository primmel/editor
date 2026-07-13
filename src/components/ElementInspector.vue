<script setup lang="ts">
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useUiStore } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();

const element = computed<Record<string, unknown> | null>(() => {
  if (!ui.selection) return null;
  const { id, type } = ui.selection;
  switch (type) {
    case 'role': return props.model.roles.find((r) => r.id === id) as unknown as Record<string, unknown> ?? null;
    case 'process': return props.model.processes.find((p) => p.id === id) as unknown as Record<string, unknown> ?? null;
    case 'provision': return props.model.provisions.find((p) => p.id === id) as unknown as Record<string, unknown> ?? null;
    case 'event': return props.model.events.find((e) => e.id === id) as unknown as Record<string, unknown> ?? null;
    case 'gateway': return props.model.gateways.find((g) => g.id === id) as unknown as Record<string, unknown> ?? null;
    case 'canvas': return props.model.pages.find((p) => p.id === id) as unknown as Record<string, unknown> ?? null;
    case 'dataclass': return props.model.dataclasses.find((d) => d.id === id) as unknown as Record<string, unknown> ?? null;
    case 'registry': return props.model.regs.find((r) => r.id === id) as unknown as Record<string, unknown> ?? null;
    case 'measurement': return props.model.variables.find((v) => v.id === id) as unknown as Record<string, unknown> ?? null;
    default: return null;
  }
});

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return '{ … }';
  return String(val);
}

const visibleProps = computed<[string, unknown][]>(() => {
  if (!element.value) return [];
  return Object.entries(element.value).filter(([key]) => !key.startsWith('_'));
});
</script>

<template>
  <div class="inspector">
    <template v-if="element">
      <div class="inspector-header">
        <span class="type-badge">{{ ui.selection?.type }}</span>
        <code class="element-id">{{ ui.selection?.id }}</code>
      </div>
      <dl class="prop-list">
        <template v-for="[key, val] in visibleProps" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ formatValue(val) }}</dd>
        </template>
      </dl>
    </template>
    <div v-else class="inspector-empty">
      Click an element in the tree or canvas to inspect its properties.
    </div>
  </div>
</template>

<style scoped>
.inspector { height: 100%; overflow-y: auto; padding: 0.75rem; }
.inspector-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}
.type-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--accent, #4a6fa5);
  color: #fff;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}
.element-id { font-family: 'SF Mono', Menlo, monospace; font-size: 0.82rem; color: #333; }
.prop-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.75rem;
  font-size: 0.8rem;
  margin: 0;
}
.prop-list dt { color: #888; font-weight: 500; }
.prop-list dd { margin: 0; color: #333; word-break: break-word; }
.inspector-empty {
  color: #aaa;
  font-size: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
}
</style>

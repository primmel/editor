<script setup lang="ts">
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useUiStore } from '../stores/ui';
import { activePlugins } from '../plugins';
import ProcessInspector from './inspectors/ProcessInspector.vue';
import OtherInspectors from './inspectors/OtherInspectors.vue';
import DataClassInspector from './inspectors/DataClassInspector.vue';
import RegistryInspector from './inspectors/RegistryInspector.vue';
import EnumInspector from './inspectors/EnumInspector.vue';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();

const target = computed(() => {
  if (!ui.selection) return null;
  return ui.selection;
});

/** The plugin inspector for the selection's type (TODO.editor/40 —
 *  the registry's `inspectors` slot: a program's constructs are
 *  inspected by the program's components, never a kernel branch). */
const pluginInspector = computed(() => {
  if (!target.value) return null;
  for (const plugin of activePlugins(props.model)) {
    const hit = (plugin.inspectors ?? []).find(i => i.type === target.value!.type);
    if (hit) return hit.component;
  }
  return null;
});
</script>

<template>
  <div class="inspector">
    <template v-if="target">
      <div class="inspector-header">
        <span class="type-badge">{{ target.type }}</span>
        <code class="element-id">{{ target.id }}</code>
      </div>

      <ProcessInspector
        v-if="target.type === 'process'"
        :model="props.model"
        :process-id="target.id"
      />
      <OtherInspectors
        v-else-if="['approval', 'event', 'gateway', 'subprocess'].includes(target.type)"
        :model="props.model"
        :kind="target.type as 'approval' | 'event' | 'gateway' | 'subprocess'"
        :element-id="target.id"
      />
      <DataClassInspector
        v-else-if="target.type === 'dataclass'"
        :model="props.model"
        :class-id="target.id"
      />
      <RegistryInspector
        v-else-if="target.type === 'registry'"
        :model="props.model"
        :registry-id="target.id"
      />
      <EnumInspector
        v-else-if="target.type === 'enum'"
        :model="props.model"
        :enum-id="target.id"
      />
      <component
        :is="pluginInspector"
        v-else-if="pluginInspector"
        :model="props.model"
        :element-id="target.id"
      />
      <div v-else class="inspector-note">
        The {{ target.type }} inspector arrives with its wave (mapper: 07, measurements: 16).
      </div>
    </template>
    <div v-else class="inspector-empty">
      Click an element in the tree or canvas to inspect and edit its properties.
    </div>
  </div>
</template>

<style scoped>
.inspector { height: 100%; overflow-y: auto; padding: 1rem; }
.inspector-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.type-badge {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-glow);
  font-weight: 500;
}
.element-id {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text);
  font-weight: 500;
}
.inspector-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  padding: 1rem 0.25rem;
}
.inspector-empty {
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
  font-style: italic;
}
</style>

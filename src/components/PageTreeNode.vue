<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// One page-tree row + its children (recursive — a script-setup
// component self-references by filename).
// ─────────────────────────────────────────────────────────────────────
import type { PageNode } from '../lib/pages';

defineProps<{
  node: PageNode;
  depth: number;
  activeId: string | null;
  renamingId: string | null;
  renameDraft: string;
  renameError: string;
}>();

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'rename', id: string): void;
  (e: 'update:renameDraft', v: string): void;
  (e: 'commitRename'): void;
  (e: 'cancelRename'): void;
}>();

function onRenameKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('commitRename');
  if (e.key === 'Escape') emit('cancelRename');
}
</script>

<template>
  <div class="page-tree-node">
    <div v-if="renamingId === node.id" class="rename-row" :style="{ paddingLeft: `${depth * 0.9}rem` }">
      <input
        class="rename-input"
        data-testid="page-rename-input"
        :value="renameDraft"
        @input="emit('update:renameDraft', ($event.target as HTMLInputElement).value)"
        @keyup="onRenameKeyup"
      />
      <button type="button" data-testid="page-rename-commit" @click="emit('commitRename')">✓</button>
      <span v-if="renameError" class="rename-error">{{ renameError }}</span>
    </div>
    <div v-else class="page-row" :style="{ paddingLeft: `${depth * 0.9}rem` }">
      <button
        class="page-link"
        :class="{ active: activeId === node.id, root: depth === 0 }"
        :data-testid="`page-node-${node.id}`"
        @click="emit('open', node.id)"
        @dblclick="emit('rename', node.id)"
      >{{ node.id }}</button>
      <button
        type="button"
        class="page-rename"
        title="rename"
        :data-testid="`page-rename-${node.id}`"
        @click="emit('rename', node.id)"
      >✎</button>
    </div>

    <PageTreeNode
      v-for="c in node.children"
      :key="c.id"
      :node="c"
      :depth="depth + 1"
      :active-id="activeId"
      :renaming-id="renamingId"
      :rename-draft="renameDraft"
      :rename-error="renameError"
      @open="emit('open', $event)"
      @rename="emit('rename', $event)"
      @update:rename-draft="emit('update:renameDraft', $event)"
      @commit-rename="emit('commitRename')"
      @cancel-rename="emit('cancelRename')"
    />
  </div>
</template>

<style scoped>
.page-row, .rename-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.page-link {
  flex: 1;
  text-align: left;
  border: none;
  background: none;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border-left: 2px solid transparent;
}
.page-link:hover { background: var(--bg-elevated); }
.page-link.active {
  background: var(--accent-soft);
  color: var(--accent);
  border-left-color: var(--accent);
}
.page-link.root { font-weight: 600; }
.page-rename {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.62rem;
  padding: 0.1rem 0.2rem;
}
.page-rename:hover { color: var(--accent); }
.rename-row { padding: 0.15rem 0.4rem; }
.rename-input {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
.rename-row button {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.62rem;
  width: 18px;
  height: 18px;
  padding: 0;
}
.rename-error {
  font-size: 0.6rem;
  color: #b85555;
}
</style>

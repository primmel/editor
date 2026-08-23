<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The page tree (TODO.editor/06) — the subprocess-page hierarchy:
// root → linked pages → nested, with create (an orphan page, linked
// later via the process inspector) and rename (inline, one command).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { buildPageTree, orphanPages, type PageNode } from '../lib/pages';
import { createElement, mintId, renamePage } from '../lib/commands';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';
import PageTreeNode from './PageTreeNode.vue';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const ui = useUiStore();

const tree = computed<PageNode | null>(() => {
  void modelStore.version;
  return buildPageTree(props.model);
});
const orphans = computed<string[]>(() => {
  void modelStore.version;
  return orphanPages(props.model);
});

// ── Rename (inline) ──────────────────────────────────────────────────
const renamingId = ref<string | null>(null);
const renameDraft = ref('');
const renameError = ref('');

function beginRename(id: string) {
  if (modelStore.readOnly) return; // the viewer never renames
  renamingId.value = id;
  renameDraft.value = id;
  renameError.value = '';
}

function commitRename() {
  if (!renamingId.value) return;
  const oldId = renamingId.value;
  const newId = renameDraft.value.trim();
  if (!newId || newId === oldId) {
    renamingId.value = null;
    return;
  }
  try {
    modelStore.execute(renamePage(oldId, newId));
    if (ui.activeCanvasId === oldId) ui.setCanvas(newId);
    renamingId.value = null;
  } catch (e) {
    renameError.value = (e as Error).message;
  }
}

function createPage() {
  const id = mintId(props.model, 'Page');
  modelStore.execute(createElement('subprocess', id));
  ui.select(id, 'subprocess');
}
</script>

<template>
  <div class="page-tree" data-testid="page-tree">
    <div class="page-tree-header">
      Pages
      <button v-if="!modelStore.readOnly" type="button" class="page-add" title="new page" data-testid="page-add" @click="createPage">+</button>
    </div>

    <PageTreeNode
      v-if="tree"
      :node="tree"
      :depth="0"
      :active-id="ui.activeCanvasId"
      :renaming-id="renamingId"
      :rename-draft="renameDraft"
      :rename-error="renameError"
      @open="ui.setCanvas($event)"
      @rename="beginRename"
      @update:rename-draft="renameDraft = $event"
      @commit-rename="commitRename"
      @cancel-rename="renamingId = null"
    />

    <div v-if="orphans.length" class="orphan-section">
      <div class="orphan-header">unlinked</div>
      <div v-for="id in orphans" :key="id" class="orphan-row">
        <button
          class="page-link orphan"
          :class="{ active: ui.activeCanvasId === id }"
          :data-testid="`page-orphan-${id}`"
          @click="ui.setCanvas(id)"
        >{{ id }}</button>
        <button v-if="!modelStore.readOnly" type="button" class="page-rename" title="rename" @click="beginRename(id)">✎</button>
      </div>
      <div v-if="renamingId && orphans.includes(renamingId)" class="rename-row">
        <input
          v-model="renameDraft"
          class="rename-input"
          data-testid="page-rename-input"
          @keyup.enter="commitRename"
          @keyup.esc="renamingId = null"
        />
        <button type="button" data-testid="page-rename-commit" @click="commitRename">✓</button>
        <span v-if="renameError" class="rename-error">{{ renameError }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-tree {
  padding: 0.5rem 0.5rem 0.25rem;
  border-bottom: 1px solid var(--border);
}
.page-tree-header {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
  padding: 0 0.5rem;
}
.page-add {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.62rem;
  width: 16px;
  height: 16px;
  line-height: 1;
  padding: 0;
}
.orphan-section { margin-top: 0.35rem; }
.orphan-header {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  padding: 0 0.5rem 0.2rem;
}
.orphan-row {
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
.page-link.orphan { color: var(--text-faint); font-style: italic; }
.page-rename {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.62rem;
  padding: 0.1rem 0.2rem;
}
.page-rename:hover { color: var(--accent); }
.rename-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.4rem;
}
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

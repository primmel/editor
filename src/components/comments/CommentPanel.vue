<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The comment panel (TODO.editor/14) — the selected element's thread:
// add, reply, resolve/unresolve, delete (the subtree). Provenance is
// visible (author + timestamp); the audit note states comments are
// authoring scratch, never certification evidence.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { addComment, deleteComment, replyComment, setResolved, threadFor } from '../../lib/comments';
import { useModelStore } from '../../stores/model';
import { useUiStore } from '../../stores/ui';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const ui = useUiStore();

const AUTHOR = 'operator';

const thread = computed(() => {
  void modelStore.version;
  return ui.selection ? threadFor(props.model, ui.selection.id) : [];
});

const draft = ref('');
const replyDrafts = ref<Record<string, string>>({});
const replyingTo = ref<string | null>(null);

function add() {
  const text = draft.value.trim();
  if (!text || !ui.selection) return;
  modelStore.execute(addComment(ui.selection.id, text, AUTHOR));
  draft.value = '';
}

function reply(parentId: string) {
  const text = (replyDrafts.value[parentId] ?? '').trim();
  if (!text) return;
  modelStore.execute(replyComment(parentId, text, AUTHOR));
  replyDrafts.value = { ...replyDrafts.value, [parentId]: '' };
  replyingTo.value = null;
}
</script>

<template>
  <div class="comment-panel" data-testid="comment-panel">
    <div class="comment-header">
      comments
      <span v-if="ui.selection" class="comment-target">{{ ui.selection.id }}</span>
    </div>

    <div v-if="!ui.selection" class="comment-empty">select an element to see its thread</div>

    <template v-else>
      <div v-if="!thread.length" class="comment-empty">no comments yet</div>

      <div
        v-for="c in thread"
        :key="c.id"
        class="comment-row"
        :class="{ resolved: c.resolved, reply: c.replyTo !== null }"
        :data-testid="`comment-${c.id}`"
      >
        <div class="comment-meta">
          <span class="comment-author">{{ c.author }}</span>
          <span class="comment-time">{{ c.timestamp.slice(0, 16).replace('T', ' ') }}</span>
          <span v-if="c.replyTo" class="comment-replyto">↳ {{ c.replyTo }}</span>
          <span class="comment-actions" v-if="!modelStore.readOnly">
            <button
              type="button"
              class="comment-action"
              :data-testid="`comment-resolve-${c.id}`"
              :title="c.resolved ? 'unresolve' : 'resolve'"
              @click="modelStore.execute(setResolved(c.id, !c.resolved))"
            >{{ c.resolved ? '↩' : '✓' }}</button>
            <button
              v-if="c.replyTo === null"
              type="button"
              class="comment-action"
              :data-testid="`comment-reply-${c.id}`"
              title="reply"
              @click="replyingTo = replyingTo === c.id ? null : c.id"
            >↵</button>
            <button
              type="button"
              class="comment-action delete"
              :data-testid="`comment-delete-${c.id}`"
              title="delete"
              @click="modelStore.execute(deleteComment(c.id))"
            >✕</button>
          </span>
        </div>
        <div class="comment-text">{{ c.text }}</div>

        <div v-if="replyingTo === c.id" class="comment-replybox">
          <input
            class="comment-input"
            v-model="replyDrafts[c.id]"
            placeholder="reply…"
            :data-testid="`reply-input-${c.id}`"
            @keyup.enter="reply(c.id)"
          />
          <button type="button" class="comment-send" :data-testid="`reply-send-${c.id}`" @click="reply(c.id)">↵</button>
        </div>
      </div>

      <div class="comment-add" v-if="!modelStore.readOnly">
        <input
          class="comment-input"
          v-model="draft"
          placeholder="add a comment…"
          data-testid="comment-input"
          @keyup.enter="add"
        />
        <button type="button" class="comment-send" :disabled="!draft.trim()" data-testid="comment-send" @click="add">+</button>
      </div>
    </template>

    <p class="comment-note">comments are authoring scratch — never certification evidence</p>
  </div>
</template>

<style scoped>
.comment-panel {
  border-top: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
}
.comment-header {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.comment-target {
  color: var(--accent);
  text-transform: none;
  letter-spacing: 0;
}
.comment-empty {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  padding: 0.3rem 0;
}
.comment-row {
  border-left: 2px solid var(--border);
  padding: 0.25rem 0.4rem;
  margin-bottom: 0.35rem;
}
.comment-row.reply { margin-left: 1rem; }
.comment-row.resolved { opacity: 0.55; }
.comment-row.resolved .comment-text { text-decoration: line-through; }
.comment-meta {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  font-size: 0.6rem;
}
.comment-author { color: var(--accent); font-weight: 600; }
.comment-time { color: var(--text-faint); font-family: var(--font-mono); }
.comment-replyto { color: var(--text-faint); font-family: var(--font-mono); }
.comment-actions { margin-left: auto; display: flex; gap: 0.15rem; }
.comment-action {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.62rem;
  padding: 0.05rem 0.2rem;
}
.comment-action:hover { color: var(--accent); }
.comment-action.delete:hover { color: #b85555; }
.comment-text {
  font-size: 0.74rem;
  color: var(--text);
  margin-top: 0.15rem;
  white-space: pre-wrap;
}
.comment-replybox {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.3rem;
}
.comment-add {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.4rem;
}
.comment-input {
  flex: 1;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
}
.comment-send {
  width: 26px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.comment-send:disabled { opacity: 0.4; cursor: default; }
.comment-note {
  font-size: 0.6rem;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 0.5rem;
}
</style>

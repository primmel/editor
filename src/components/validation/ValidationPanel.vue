<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The validation panel (TODO.editor/29) — the kernel's validate() on
// the live model: severity counts, the issue list (code, construct,
// element, message), click an issue to select the offending element.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { issueTarget, validationSummary } from '../../lib/validation';
import { useModelStore } from '../../stores/model';
import { useUiStore } from '../../stores/ui';
import type { SelectionType } from '../../stores/ui';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const ui = useUiStore();

const summary = computed(() => {
  void modelStore.version;
  return validationSummary(props.model);
});

function onIssue(issue: (typeof summary.value.issues)[number]) {
  const target = issueTarget(props.model, issue);
  if (target) ui.select(target.id, target.kind as SelectionType);
}
</script>

<template>
  <div class="validation-panel" data-testid="validation-panel">
    <div class="validation-header" data-testid="validation-summary">
      <span v-if="summary.errors === 0 && summary.warnings === 0" class="val-chip clean" data-testid="val-clean">
        ✓ clean
      </span>
      <span v-if="summary.errors > 0" class="val-chip errors" data-testid="val-errors">
        {{ summary.errors }} error{{ summary.errors === 1 ? '' : 's' }}
      </span>
      <span v-if="summary.warnings > 0" class="val-chip warnings" data-testid="val-warnings">
        {{ summary.warnings }} warning{{ summary.warnings === 1 ? '' : 's' }}
      </span>
      <span v-if="summary.infos > 0" class="val-chip infos">{{ summary.infos }} info</span>
    </div>

    <div v-if="!summary.issues.length" class="validation-empty">
      the model validates clean (the kernel's validators: empty ids, form references, state-machine cascades)
    </div>

    <button
      v-for="(issue, i) in summary.issues"
      :key="i"
      type="button"
      class="issue-row"
      :class="issue.severity"
      :data-testid="`issue-${i}`"
      @click="onIssue(issue)"
    >
      <span class="issue-code">{{ issue.code }}</span>
      <span class="issue-construct">{{ issue.construct }}<template v-if="issue.id"> · {{ issue.id }}</template></span>
      <span class="issue-message">{{ issue.message }}</span>
    </button>
  </div>
</template>

<style scoped>
.validation-panel { padding: 0.75rem; font-size: 0.78rem; }
.validation-header {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}
.val-chip {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.val-chip.clean { background: rgba(122, 158, 94, 0.15); color: var(--sage); }
.val-chip.errors { background: rgba(184, 85, 85, 0.15); color: #b85555; }
.val-chip.warnings { background: rgba(212, 148, 66, 0.15); color: #d49442; }
.val-chip.infos { background: var(--bg-elevated); color: var(--text-muted); }
.validation-empty {
  color: var(--text-faint);
  font-size: 0.7rem;
  font-style: italic;
  padding: 0.5rem 0;
}
.issue-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.5rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 2px solid var(--border);
  padding: 0.3rem 0.45rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.issue-row:hover { background: var(--bg-elevated); }
.issue-row.error { border-left-color: #b85555; }
.issue-row.warning { border-left-color: #d49442; }
.issue-row.info { border-left-color: var(--text-faint); }
.issue-code {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--accent);
  font-weight: 600;
}
.issue-construct {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-faint);
}
.issue-message {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  color: var(--text);
}
</style>

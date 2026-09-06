<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The check panel (TODO.editor/05, slice 4) — `primmel check` in the
// right rail. The checks are fs-bound by design (they judge the SAVED
// package), so the run rides the dev server's package API like open/
// save do; the panel joins the issue list to the kernel's rule catalog
// (checkView): severity chips, family groups, KNOWN badges, rule docs.
// The wall is honest: no package open → nothing to check; working
// changes count only after a save.
// ─────────────────────────────────────────────────────────────────────
import { computed, onMounted, ref, watch } from 'vue';
import { checkPackageViaApi, type PackageCheckResult } from '../lib/package';
import { checkView } from '../lib/check';
import { useModelStore } from '../stores/model';

const modelStore = useModelStore();

const pkg = computed(() => modelStore.pkg);
const result = ref<PackageCheckResult | null>(null);
const running = ref(false);
const error = ref<string | null>(null);

const view = computed(() => (result.value ? checkView(result.value.issues) : null));

async function run() {
  const dir = pkg.value?.dir;
  if (!dir || running.value) return;
  running.value = true;
  error.value = null;
  try {
    result.value = await checkPackageViaApi(dir);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    running.value = false;
  }
}

// A package arriving (or changing) invalidates the run: the issues on
// screen always name the package they judged.
watch(pkg, (p, prev) => {
  if (!p) {
    result.value = null;
    error.value = null;
    return;
  }
  if (!prev || p.dir !== prev.dir) {
    result.value = null;
    void run();
  }
});

onMounted(() => {
  if (pkg.value) void run();
});
</script>

<template>
  <div class="check-panel" data-testid="check-panel">
    <div v-if="!pkg" class="check-wall" data-testid="check-wall">
      primmel check is a PACKAGE gate: it judges the manifest and the files as saved on disk. Open a package
      directory (Open pkg) to run it here — the loose buffer has no manifest to check against.
    </div>

    <template v-else>
      <div class="check-toolbar">
        <button type="button" class="check-run" data-testid="check-run" :disabled="running" @click="run">
          {{ running ? 'checking…' : 'run primmel check' }}
        </button>
        <span class="check-scope" data-testid="check-scope">the saved package · {{ pkg.id }}</span>
      </div>
      <div class="check-note">judges the files as saved on disk — save first to include working changes</div>

      <div v-if="error" class="check-error" data-testid="check-error">{{ error }}</div>

      <template v-if="view">
        <div class="check-header" data-testid="check-summary">
          <span v-if="view.clean" class="val-chip clean" data-testid="check-clean">✓ clean</span>
          <span v-if="view.errors > 0" class="val-chip errors" data-testid="check-errors">
            {{ view.errors }} error{{ view.errors === 1 ? '' : 's' }}
          </span>
          <span v-if="view.warnings > 0" class="val-chip warnings" data-testid="check-warnings">
            {{ view.warnings }} warning{{ view.warnings === 1 ? '' : 's' }}
          </span>
          <span v-if="view.known > 0" class="val-chip infos" data-testid="check-known">
            {{ view.known }} known
          </span>
        </div>

        <div v-if="view.families.length === 0" class="check-empty" data-testid="check-empty">
          primmel check reports no issues for this package.
        </div>

        <div
          v-for="group in view.families"
          :key="group.family"
          class="check-family"
          :data-testid="`check-family-${group.family}`"
        >
          <div class="family-head">
            <span class="family-name">{{ group.family }}</span>
            <span class="family-counts">
              <template v-if="group.errors">{{ group.errors }}e</template>
              <template v-if="group.warnings"> {{ group.warnings }}w</template>
              <template v-if="group.known"> {{ group.known }} known</template>
            </span>
          </div>
          <div
            v-for="(row, i) in group.issues"
            :key="i"
            class="issue-row"
            :class="[row.issue.severity, { known: row.known }]"
            :data-testid="`check-issue-${group.family}-${i}`"
          >
            <span class="issue-code">{{ row.issue.check }}<template v-if="row.rule"> · {{ row.rule.name }}</template></span>
            <span v-if="row.known" class="known-badge">KNOWN</span>
            <span class="issue-message">{{ row.issue.message }}</span>
            <details v-if="row.rule" class="issue-docs">
              <summary>rule docs</summary>
              {{ row.rule.docs }} · level {{ row.rule.level }} · catalog severity {{ row.rule.severity }}
            </details>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.check-panel { padding: 0.75rem; font-size: 0.78rem; }
.check-wall {
  color: var(--text-faint);
  font-size: 0.7rem;
  font-style: italic;
  padding: 0.5rem 0;
  line-height: 1.5;
}
.check-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.check-run {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
}
.check-run:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.check-run:disabled { opacity: 0.5; cursor: default; }
.check-scope {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-faint);
}
.check-note {
  color: var(--text-faint);
  font-size: 0.66rem;
  font-style: italic;
  margin-bottom: 0.6rem;
}
.check-error {
  color: #b85555;
  font-size: 0.7rem;
  margin-bottom: 0.5rem;
  white-space: pre-wrap;
}
.check-header {
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
.check-empty {
  color: var(--text-faint);
  font-size: 0.7rem;
  font-style: italic;
  padding: 0.5rem 0;
}
.check-family { margin-bottom: 0.6rem; }
.family-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.15rem;
  margin-bottom: 0.3rem;
}
.family-name {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.family-counts {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-faint);
}
.issue-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.5rem;
  width: 100%;
  border-left: 2px solid var(--border);
  padding: 0.3rem 0.45rem;
  margin-bottom: 0.25rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.issue-row.error { border-left-color: #b85555; }
.issue-row.warning { border-left-color: #d49442; }
.issue-row.known { opacity: 0.6; }
.issue-code {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--accent);
  font-weight: 600;
}
.known-badge {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.05rem 0.3rem;
  justify-self: end;
}
.issue-message {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  color: var(--text);
}
.issue-docs {
  grid-column: 1 / -1;
  font-size: 0.64rem;
  color: var(--text-faint);
}
.issue-docs summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
}
</style>

<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The editions panel (TODO.editor wave 05, slice 2) — the edition
// diff/publish flow. The user picks a BASE package directory through
// the same package intake Open pkg uses (the dev server's provenance
// load — no git shell-out, no node backend of its own); the kernel's
// diffStandards compares it (a, the old state) against the working
// package (b, the new one), live off the model version. The summary
// header carries the per-tier tallies; the rows group added / removed
// / changed / moved and follow the house pattern: click selects, the
// inspector edits — never inline editing here.
//
// Finalize ("declare the edition"): the comment-true save persists the
// working copy first; the label prompt (prefilled with the current
// year) prepends to the manifest's `editions` set through the same
// save path; the release-note DRAFT generates from the ModelDiff and
// downloads to the browser — NEVER written into the package directory
// (a downstream byte-contract guard walks those trees) and NEVER an
// npm/git publish: the release act stays in git + CI.
// ─────────────────────────────────────────────────────────────────────
import { computed, onMounted, ref, watch } from 'vue';
import { diffStandards, load } from '@primmel/primmel';
import { openPackageDir, writePackageFiles } from '../lib/package';
import { planPackageSave } from '../lib/package-save';
import { downloadText } from '../lib/save';
import {
  editionDiffGroups,
  editionLabelError,
  editionTierRows,
  prependEdition,
  releaseNoteDraft,
  releaseNoteFileName,
  suggestedEditionLabel,
} from '../lib/edition';
import { DIFF_TINTS } from '../lib/diff-view';
import { useEditionStore } from '../stores/edition';
import { useModelStore } from '../stores/model';
import { useUiStore, type SelectionType } from '../stores/ui';

const modelStore = useModelStore();
const editionStore = useEditionStore();
const ui = useUiStore();

const pkg = computed(() => modelStore.pkg);
const base = computed(() => editionStore.base);

/** The diff (a = the picked base, b = the working package) — live off
 *  the model version, the save preview's pattern: an edit re-diffs. */
const diff = computed(() => {
  void modelStore.version;
  const b = base.value;
  const working = modelStore.standard;
  if (!b || !working) return null;
  return diffStandards(b.standard, working);
});
const tierRows = computed(() => (diff.value ? editionTierRows(diff.value) : []));
const groups = computed(() => (diff.value ? editionDiffGroups(diff.value) : []));

/** The row click-through: the diff entry's kind (the Standard
 *  collection) maps to the inspector's selection type — the model
 *  tree's mapping. Kinds without an inspector type render static
 *  (select-to-inspect stays the only authoring path). */
const SELECTION_TYPE: Record<string, SelectionType> = {
  terms: 'term',
  references: 'reference',
  roles: 'role',
  quantityRegisters: 'quantityRegister',
  enums: 'enum',
  variables: 'measurement',
  activityArchetypes: 'activityArchetype',
  connectorProfiles: 'connectorProfile',
  subjects: 'subject',
  instruments: 'instrument',
  attributeDefinitions: 'attributeDefinition',
  capabilities: 'capability',
  behaviors: 'behavior',
  conditionSets: 'conditionSet',
  instances: 'instance',
  duals: 'dual',
  artifactDefinitions: 'artifactDefinition',
  artifactInstances: 'artifactInstance',
  requirements: 'requirement',
  requirementClasses: 'requirementClass',
  conformanceTests: 'conformanceTest',
  conformanceClasses: 'conformanceClass',
  forms: 'form',
  symbols: 'symbol',
  calculations: 'calculation',
  verdicts: 'verdict',
  tables: 'table',
  testPointSets: 'testPointSet',
  referenceMaterials: 'referenceMaterial',
  processes: 'process',
  pages: 'canvas',
  dataclasses: 'dataclass',
  regs: 'registry',
  gateways: 'gateway',
  events: 'event',
  approvals: 'approval',
  stateMachines: 'stateMachine',
  monitors: 'monitor',
  passports: 'passport',
  provisions: 'provision',
  notes: 'reference',
  invariants: 'invariant',
  testSequences: 'testSequence',
  formulasUsed: 'formulasUsed',
  texts: 'text',
};

function openEntry(kind: string, id: string) {
  const type = SELECTION_TYPE[kind];
  if (type) ui.select(id, type);
}

// ── The base pick (the package intake, like Open pkg) ────────────────
const baseDir = ref('');
const baseBusy = ref(false);
const baseError = ref('');

const LAST_BASE_KEY = 'primmel.lastEditionBaseDir';
onMounted(() => {
  baseDir.value = base.value?.dir ?? localStorage.getItem(LAST_BASE_KEY) ?? '';
});

async function pickBase() {
  if (baseBusy.value || !baseDir.value.trim()) return;
  baseBusy.value = true;
  baseError.value = '';
  try {
    const result = await openPackageDir(baseDir.value.trim());
    if (!editionStore.pick(result)) {
      baseError.value = editionStore.parseError;
      return;
    }
    localStorage.setItem(LAST_BASE_KEY, result.dir);
    resetFinalize();
  } catch (e) {
    baseError.value = (e as Error).message;
  } finally {
    baseBusy.value = false;
  }
}

function clearBase() {
  editionStore.clear();
  resetFinalize();
}

// ── Finalize: save → declare the edition (same save path) → the
//    release-note draft as a browser download. ────────────────────────
const finalizing = ref(false);
const editionLabel = ref('');
const finalizeBusy = ref(false);
const finalizeError = ref('');
const finalized = ref('');
const noteDraft = ref('');
const finalizeWarnings = ref<string[]>([]);

const labelError = computed(() =>
  editionLabelError(modelStore.standard?.packageManifest, editionLabel.value.trim()),
);

function beginFinalize() {
  editionLabel.value = suggestedEditionLabel();
  finalizeError.value = '';
  finalizing.value = true;
}

function resetFinalize() {
  finalizing.value = false;
  finalizeError.value = '';
  finalized.value = '';
  noteDraft.value = '';
  finalizeWarnings.value = [];
}

// A different package arriving invalidates the finalize state (the base
// pick stays — the comparison is the user's).
watch(() => pkg.value?.dir, resetFinalize);

async function finalize() {
  const session = pkg.value;
  const working = modelStore.standard;
  const theDiff = diff.value;
  if (!session || !working || !base.value || !theDiff || finalizeBusy.value) return;
  if (modelStore.parseError) return;
  const label = editionLabel.value.trim();
  if (labelError.value) {
    finalizeError.value = labelError.value;
    return;
  }
  finalizeBusy.value = true;
  finalizeError.value = '';
  try {
    // (a) the comment-true save: the working copy persists as it
    //     stands (per-file span splices; untouched files never move).
    const saveContent = planPackageSave(load(modelStore.loadedText, { strict: true }), working, session);
    if (saveContent.writes.length > 0) {
      await writePackageFiles(session.dir, saveContent.writes.map((w) => ({ path: w.path, text: w.text })));
      modelStore.markPackageSaved(saveContent);
    }
    // (b) the edition claim: the label prepends to the manifest's
    //     editions set (newest first) and persists through the same
    //     comment-true path (the manifest rewrites canonically — the
    //     kernel attests no spans inside package.primmel).
    modelStore.execute(prependEdition(label));
    const current = modelStore.pkg;
    if (!current || !modelStore.standard) throw new Error('the package session closed mid-finalize');
    const saveManifest = planPackageSave(load(modelStore.loadedText, { strict: true }), modelStore.standard, current);
    if (saveManifest.writes.length > 0) {
      await writePackageFiles(current.dir, saveManifest.writes.map((w) => ({ path: w.path, text: w.text })));
      modelStore.markPackageSaved(saveManifest);
    }
    finalizeWarnings.value = [
      ...saveContent.warnings,
      ...saveContent.foreignTouched.map((f) => `${f.kind} ${f.id} ${f.status} — owned by package ${f.package}; not written`),
      ...saveManifest.warnings,
    ];
    // (c) the release-note draft from the diff — a browser download,
    //     never a package file, never an npm/git publish.
    noteDraft.value = releaseNoteDraft(theDiff, { packageId: current.id, edition: label });
    downloadText(releaseNoteFileName(current.id, label), noteDraft.value);
    finalized.value = label;
    finalizing.value = false;
  } catch (e) {
    finalizeError.value = (e as Error).message;
  } finally {
    finalizeBusy.value = false;
  }
}

const ROW_CAP = 40;
</script>

<template>
  <div class="edition-panel" data-testid="edition-panel">
    <div v-if="!pkg" class="edition-wall" data-testid="edition-wall">
      the edition diff needs a package session: it compares the working package against a previous-edition
      base, and finalizing writes through the package save. Open a package directory (Open pkg) — the loose
      buffer has no editions to publish.
    </div>

    <template v-else>
      <div class="edition-label">diff base — the previous edition</div>
      <div v-if="base" class="base-card" data-testid="edition-base">
        <div class="base-head">
          <code class="base-id">{{ base.id }}@{{ base.version || '?' }}</code>
          <button type="button" class="base-clear" data-testid="edition-base-clear" @click="clearBase">change</button>
        </div>
        <div class="base-dir" data-testid="edition-base-dir-label">{{ base.dir }}</div>
        <div v-if="base.issues.length" class="base-issues" data-testid="edition-base-issues">
          load advisories: {{ base.issues.join('; ') }}
        </div>
        <div v-if="diff && !diff.editionComparison" class="edition-note" data-testid="edition-not-edition-comparison">
          the base is a different package ({{ base.id }} vs {{ pkg.id }}) — the diff is structural, not an
          edition comparison
        </div>
      </div>
      <div class="base-picker">
        <input
          v-model="baseDir"
          class="base-input"
          placeholder="…/primmel-packages/oiml-r60 (the previous edition)"
          data-testid="edition-base-dir"
          @keyup.enter="pickBase"
        />
        <button
          type="button"
          class="base-open"
          :disabled="!baseDir.trim() || baseBusy"
          data-testid="edition-base-open"
          @click="pickBase"
        >{{ baseBusy ? 'opening…' : base ? 're-pick base' : 'open base' }}</button>
      </div>
      <div class="edition-hint">
        the base opens through the same package intake as Open pkg — its merged model is the old state;
        your working package is the new one
      </div>
      <div v-if="baseError" class="edition-error" data-testid="edition-base-error">{{ baseError }}</div>

      <div v-if="!base" class="edition-wall" data-testid="edition-no-base">
        pick a base package to see the diff — and to finalize: the edition claim and the release-note
        draft both need the diff against the previous edition, so finalize stays unavailable until then.
      </div>

      <template v-else-if="diff">
        <div class="edition-label">the edition diff — {{ diff.aLabel }} → {{ diff.bLabel }}</div>
        <div class="edition-summary" data-testid="edition-summary">
          <div class="summary-total" data-testid="edition-total">
            +{{ diff.added.length }} added · −{{ diff.removed.length }} removed · ~{{ diff.changed.length }} changed
            · &gt;{{ diff.moved.length }} moved · {{ diff.unchanged }} unchanged
          </div>
          <div
            v-for="row in tierRows"
            :key="row.tier"
            class="tier-row"
            :class="{ quiet: row.quiet }"
            :data-testid="`edition-tier-${row.tier}`"
          >
            <span class="tier-name">{{ row.tier }}</span>
            <span class="tier-counts">
              <span :style="{ color: DIFF_TINTS.added }">+{{ row.added }}</span>
              <span :style="{ color: DIFF_TINTS.removed }">−{{ row.removed }}</span>
              <span :style="{ color: DIFF_TINTS.changed }">~{{ row.changed }}</span>
              <span :style="{ color: DIFF_TINTS.moved }">&gt;{{ row.moved }}</span>
            </span>
          </div>
        </div>
        <div v-if="diff.empty" class="edition-note" data-testid="edition-empty">
          no element changes against the base — finalizing still declares the edition (the release note
          says so)
        </div>

        <template v-for="group in groups" :key="group.status">
          <div class="edition-label" :data-testid="`edition-group-${group.status}`">{{ group.status }} ({{ group.rows.length }})</div>
          <component
            :is="SELECTION_TYPE[e.kind] ? 'button' : 'div'"
            v-for="e in group.rows.slice(0, ROW_CAP)"
            :key="e.key"
            type="button"
            class="entry-row"
            :class="{ static: !SELECTION_TYPE[e.kind] }"
            :data-testid="`edition-row-${e.key}`"
            @click="openEntry(e.kind, e.id)"
          >
            <div class="entry-head">
              <span class="entry-dot" :style="{ background: DIFF_TINTS[group.status] }" />
              <code class="entry-id">{{ e.id }}</code>
              <span class="entry-kind">{{ e.kind }} · {{ e.tier }}</span>
            </div>
            <div v-if="e.sub" class="entry-sub" :data-testid="`edition-row-sub-${e.key}`">{{ e.sub }}</div>
          </component>
          <div v-if="group.rows.length > ROW_CAP" class="edition-note">
            …and {{ group.rows.length - ROW_CAP }} more
          </div>
        </template>

        <template v-if="!modelStore.readOnly">
          <div class="edition-label">finalize — declare the new edition</div>
          <button
            v-if="!finalizing"
            type="button"
            class="finalize-btn"
            :disabled="!!modelStore.parseError"
            data-testid="edition-finalize"
            @click="beginFinalize"
          >finalize edition…</button>
          <template v-else>
            <label class="finalize-field">
              <span>edition label (free string — prepended to the manifest's editions set)</span>
              <input v-model="editionLabel" class="base-input" data-testid="edition-label" @keyup.enter="finalize" />
            </label>
            <div v-if="labelError" class="edition-error" data-testid="edition-label-error">{{ labelError }}</div>
            <div class="finalize-actions">
              <button
                type="button"
                class="finalize-btn primary"
                :disabled="!!labelError || finalizeBusy"
                data-testid="edition-confirm"
                @click="finalize"
              >{{ finalizeBusy ? 'writing…' : 'save, declare, and download the release note' }}</button>
              <button type="button" class="finalize-btn" data-testid="edition-cancel" @click="finalizing = false">cancel</button>
            </div>
          </template>
          <div v-if="finalizeError" class="edition-error" data-testid="edition-finalize-error">{{ finalizeError }}</div>
          <div v-for="(w, i) in finalizeWarnings" :key="i" class="edition-note" data-testid="edition-finalize-warning">{{ w }}</div>
          <div v-if="finalized" class="edition-done" data-testid="edition-finalized">
            edition {{ finalized }} declared — the manifest's editions set leads with it and the working copy
            is saved; the release-note draft downloaded (never written into the package). The release act
            stays in git + CI.
          </div>
          <details v-if="noteDraft" class="edition-note-details" data-testid="edition-note">
            <summary>the release-note draft</summary>
            <pre data-testid="edition-note-text">{{ noteDraft }}</pre>
          </details>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.edition-panel { padding: 0.75rem; font-size: 0.78rem; }
.edition-wall {
  color: var(--text-faint);
  font-size: 0.7rem;
  font-style: italic;
  padding: 0.5rem 0;
  line-height: 1.5;
}
.edition-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 0.6rem 0 0.3rem;
}
.edition-label:first-child { margin-top: 0; }
.base-card {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.35rem;
}
.base-head { display: flex; align-items: center; gap: 0.5rem; }
.base-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 600;
  word-break: break-all;
}
.base-clear {
  margin-left: auto;
  padding: 0.08rem 0.45rem;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.62rem;
  font-family: var(--font-mono);
}
.base-clear:hover { color: var(--accent); border-color: var(--accent); }
.base-dir {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-faint);
  margin-top: 0.15rem;
  word-break: break-all;
}
.base-issues { font-size: 0.66rem; color: #d49442; margin-top: 0.2rem; }
.base-picker { display: flex; gap: 0.35rem; }
.base-input {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.72rem;
  font-family: var(--font-mono);
}
.base-open {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.68rem;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.base-open:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.base-open:disabled { opacity: 0.4; cursor: default; }
.edition-hint {
  font-size: 0.64rem;
  color: var(--text-faint);
  font-style: italic;
  margin-top: 0.25rem;
  line-height: 1.4;
}
.edition-error {
  color: #b85555;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  margin-top: 0.35rem;
  white-space: pre-wrap;
}
.edition-note { color: var(--text-faint); font-size: 0.68rem; font-style: italic; padding: 0.25rem 0; line-height: 1.4; }
.edition-summary {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  margin-bottom: 0.3rem;
}
.summary-total {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text);
  margin-bottom: 0.25rem;
}
.tier-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  padding: 0.05rem 0;
}
.tier-row.quiet { opacity: 0.45; }
.tier-name { color: var(--text-muted); }
.tier-counts { display: flex; gap: 0.5rem; }
.entry-row {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.5rem;
  margin-bottom: 0.25rem;
  color: var(--text);
  cursor: pointer;
}
.entry-row:hover:not(.static) { background: var(--bg-elevated); }
.entry-row.static { cursor: default; }
.entry-head { display: flex; align-items: center; gap: 0.45rem; }
.entry-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.entry-id {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
  font-weight: 600;
  word-break: break-all;
}
.entry-kind {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.entry-sub {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  padding-left: 1.2rem;
  word-break: break-all;
}
.finalize-btn {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
}
.finalize-btn.primary { border-color: var(--accent); color: var(--accent); }
.finalize-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.finalize-btn:disabled { opacity: 0.4; cursor: default; }
.finalize-field span {
  display: block;
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-bottom: 0.15rem;
}
.finalize-actions { display: flex; gap: 0.5rem; margin-top: 0.45rem; }
.edition-done { color: var(--sage); font-size: 0.7rem; margin-top: 0.45rem; line-height: 1.5; }
.edition-note-details { margin-top: 0.45rem; }
.edition-note-details summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-muted);
}
.edition-note-details pre {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-soft);
  white-space: pre-wrap;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.5rem;
  max-height: 16rem;
  overflow-y: auto;
}
</style>

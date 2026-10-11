<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The analyse panel (the gap pack): the assessor's four worksheets —
// registry summaries (G9), the provision summary with its CSV export
// (G10), the link inventory with resolution states (G8), and the
// checklist self-assessment with its export (G7). Read-only over the
// model; the checklist marks are ephemeral until exported.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import {
  checklistCsv, checklistOf, linkInventory, provisionCsv,
  provisionSummaries, registrySummaries, type ChecklistMark,
} from '../../lib/analysis';
import { buildAssessmentReport } from '../../lib/report';
import { downloadText } from '../../lib/save';
import { useChecklistStore } from '../../stores/checklist';
import { useModelStore } from '../../stores/model';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();
const checklist = useChecklistStore();

const worksheet = ref<'registries' | 'provisions' | 'links' | 'checklist' | 'report'>('registries');
const WORKSHEETS: { id: typeof worksheet.value; label: string }[] = [
  { id: 'registries', label: 'registries' },
  { id: 'provisions', label: 'provisions' },
  { id: 'links', label: 'links' },
  { id: 'checklist', label: 'checklist' },
  { id: 'report', label: 'report' },
];

const registries = computed(() => {
  void modelStore.version;
  return registrySummaries(props.model);
});
const provisions = computed(() => {
  void modelStore.version;
  return provisionSummaries(props.model);
});
const links = computed(() => {
  void modelStore.version;
  return linkInventory(props.model);
});
const items = computed(() => {
  void modelStore.version;
  return checklistOf(props.model);
});

const linksDangling = computed(() => links.value.filter((l) => !l.resolved));
const marksDone = computed(() => items.value.filter((i) => checklist.marks[i.id]?.mark).length);
const completion = computed(() => (items.value.length ? Math.round((marksDone.value / items.value.length) * 100) : 0));

const MARKS: ChecklistMark[] = ['satisfied', 'partial', 'not-evidenced'];

function exportProvisions() {
  downloadText('provision-summary.csv', provisionCsv(provisions.value));
}
function exportChecklist() {
  downloadText('checklist.csv', checklistCsv(items.value, checklist.marks));
}

// G4's editor half: the assessment dossier — generated from the model,
// never hand-edited; the certificate plane keeps the formal documents.
const reportHtml = computed(() => {
  void modelStore.version;
  return buildAssessmentReport(props.model, { marks: checklist.marks, purpose: 'Assessment report' });
});
function exportReport() {
  downloadText('assessment-report.html', reportHtml.value);
}
</script>

<template>
  <div class="analyse" data-testid="analyse-panel">
    <div class="analyse-tabs">
      <button
        v-for="w in WORKSHEETS"
        :key="w.id"
        type="button"
        class="analyse-tab"
        :class="{ active: worksheet === w.id }"
        :data-testid="`analyse-tab-${w.id}`"
        @click="worksheet = w.id"
      >{{ w.label }}</button>
    </div>

    <!-- G9 — the registry summaries. -->
    <div v-if="worksheet === 'registries'" class="worksheet" data-testid="worksheet-registries">
      <div v-for="r in registries" :key="r.id" class="reg-card" :data-testid="`registry-${r.id}`">
        <div class="reg-head">
          <code class="reg-id">{{ r.id }}</code>
          <span v-if="r.formless" class="reg-formless">formless — no dataclass</span>
        </div>
        <div v-if="r.title" class="reg-title">{{ r.title }}</div>
        <div class="reg-row">
          <span class="reg-k">class</span>
          <code>{{ r.classId ?? '—' }}</code>
          <template v-if="r.store"><span class="reg-k">store</span><code>{{ r.store }}</code></template>
        </div>
        <div v-for="a in r.attributes" :key="a.id" class="reg-attr" :title="a.definition">
          <code>{{ a.id }}</code>
          <span class="reg-attr-type">{{ a.type }} <em v-if="a.cardinality">{{ a.cardinality }}</em></span>
        </div>
      </div>
      <div v-if="!registries.length" class="analyse-empty">the model declares no registries</div>
    </div>

    <!-- G10 — the provision summary + export. -->
    <div v-if="worksheet === 'provisions'" class="worksheet" data-testid="worksheet-provisions">
      <button type="button" class="analyse-export" data-testid="provisions-export" @click="exportProvisions">
        export the summary (CSV)
      </button>
      <div v-for="p in provisions" :key="p.id" class="prov-row" :data-testid="`provision-${p.id}`">
        <code class="prov-id">{{ p.id }}</code>
        <span class="prov-name">{{ p.modality }} — {{ p.condition }}</span>
        <span v-if="p.subjects.length" class="prov-verified">claims: {{ p.subjects.join(', ') }}</span>
        <span v-if="p.citations.length" class="prov-source">{{ p.citations.join(' · ') }}</span>
      </div>
      <div v-if="!provisions.length" class="analyse-empty">the model declares no provisions</div>
    </div>

    <!-- G8 — the link inventory. -->
    <div v-if="worksheet === 'links'" class="worksheet" data-testid="worksheet-links">
      <div class="links-tally" data-testid="links-tally">
        {{ links.length }} links · <span :class="{ bad: linksDangling.length }">{{ linksDangling.length }} dangling</span>
      </div>
      <div v-for="(l, i) in links" :key="i" class="link-row" :data-testid="`link-${i}`">
        <code class="link-src">{{ l.sourceId }}</code>
        <span class="link-pred">{{ l.predicate }}</span>
        <code class="link-target" :class="{ dangling: !l.resolved }">{{ l.targetId }}</code>
        <span v-if="!l.resolved" class="link-mark">dangling</span>
      </div>
      <div v-if="!links.length" class="analyse-empty">the model declares no cross-references</div>
    </div>

    <!-- G4 — the assessment report (the editor half). -->
    <div v-if="worksheet === 'report'" class="worksheet" data-testid="worksheet-report">
      <div class="report-actions">
        <button type="button" class="analyse-export" data-testid="report-export" @click="exportReport">
          export the report (HTML)
        </button>
        <span class="report-note">generated from the model as authored — the certificate plane keeps the formal documents</span>
      </div>
      <iframe
        class="report-preview"
        data-testid="report-preview"
        :srcdoc="reportHtml"
        title="the assessment report preview"
      />
    </div>

    <!-- G7 — the checklist self-assessment. -->
    <div v-if="worksheet === 'checklist'" class="worksheet" data-testid="worksheet-checklist">
      <div class="checklist-head">
        <div class="checklist-rail" data-testid="checklist-rail">
          <div class="checklist-rail-fill" :style="{ width: `${completion}%` }" />
        </div>
        <span class="checklist-pct" data-testid="checklist-pct">{{ completion }}%</span>
        <button type="button" class="analyse-export" data-testid="checklist-export" @click="exportChecklist">
          export the marks (CSV)
        </button>
      </div>
      <div v-for="item in items" :key="item.id" class="check-row" :data-testid="`check-${item.id}`">
        <div class="check-head">
          <code class="check-id">{{ item.id }}</code>
          <span v-if="item.clause" class="check-clause">§{{ item.clause }}</span>
        </div>
        <div class="check-statement">{{ item.statement }}</div>
        <div class="check-controls">
          <div class="check-marks">
            <button
              v-for="m in MARKS"
              :key="m"
              type="button"
              class="check-mark"
              :class="[m, { on: checklist.marks[item.id]?.mark === m }]"
              :data-testid="`check-mark-${item.id}-${m}`"
              @click="checklist.setMark(item.id, m)"
            >{{ m === 'not-evidenced' ? 'not evidenced' : m }}</button>
          </div>
          <input
            class="check-evidence"
            placeholder="evidence…"
            :value="checklist.marks[item.id]?.evidence ?? ''"
            :data-testid="`check-evidence-${item.id}`"
            @input="checklist.setEvidence(item.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div v-if="!items.length" class="analyse-empty">the model declares no requirements to assess</div>
    </div>
  </div>
</template>

<style scoped>
.analyse { padding: 0.6rem; font-size: 0.75rem; }
.analyse-tabs { display: flex; gap: 0.3rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
.analyse-tab {
  background: none; border: 1px solid var(--border-soft); border-radius: var(--radius-sm, 4px);
  color: var(--text-soft); cursor: pointer; font-size: 0.66rem; padding: 0.15rem 0.5rem;
}
.analyse-tab.active { border-color: var(--accent); color: var(--accent); }
.analyse-export { cursor: pointer; font-size: 0.64rem; }
.report-actions { display: flex; gap: 0.5rem; align-items: baseline; margin-bottom: 0.4rem; }
.report-note { font-size: 0.6rem; color: var(--text-faint); }
.report-preview { width: 100%; height: 26rem; border: 1px solid var(--border-soft); border-radius: var(--radius-sm, 4px); background: #fffdf9; }
.analyse-empty { color: var(--text-faint); font-style: italic; font-size: 0.68rem; padding: 0.25rem 0; }

.reg-card { border: 1px solid var(--border-soft); border-radius: var(--radius-sm, 4px); padding: 0.4rem 0.5rem; margin-bottom: 0.4rem; }
.reg-head { display: flex; justify-content: space-between; align-items: baseline; }
.reg-id { color: var(--accent); font-size: 0.72rem; }
.reg-formless { color: #b45309; font-size: 0.6rem; }
.reg-title { font-size: 0.68rem; color: var(--text-soft); margin-bottom: 0.25rem; }
.reg-row { display: flex; gap: 0.4rem; font-size: 0.64rem; margin-bottom: 0.2rem; }
.reg-k { color: var(--text-faint); }
.reg-attr { display: flex; justify-content: space-between; font-size: 0.64rem; padding: 0.06rem 0; border-top: 1px dotted rgba(128,128,128,0.18); }
.reg-attr-type { color: var(--text-soft); }
.reg-attr-type em { opacity: 0.5; font-style: normal; }

.prov-row { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; padding: 0.18rem 0; border-bottom: 1px dotted rgba(128,128,128,0.18); }
.prov-id { color: var(--accent); font-size: 0.68rem; }
.prov-name { flex: 1; min-width: 8rem; }
.prov-verified, .prov-source { font-size: 0.6rem; color: var(--text-soft); font-family: var(--font-mono); }

.links-tally { font-family: var(--font-mono); font-size: 0.66rem; margin-bottom: 0.4rem; }
.links-tally .bad { color: #b45309; font-weight: 700; }
.link-row { display: flex; gap: 0.45rem; align-items: baseline; font-size: 0.66rem; padding: 0.1rem 0; }
.link-pred { color: var(--text-faint); font-family: var(--font-mono); font-size: 0.58rem; }
.link-target.dangling { color: #b45309; text-decoration: underline wavy; }
.link-mark { color: #b45309; font-size: 0.58rem; margin-left: auto; }

.checklist-head { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.checklist-rail { flex: 1; height: 4px; background: var(--border-soft); border-radius: 999px; overflow: hidden; }
.checklist-rail-fill { height: 100%; background: var(--sage); transition: width 0.2s ease; }
.checklist-pct { font-family: var(--font-mono); font-size: 0.64rem; }
.check-row { border: 1px solid var(--border-soft); border-radius: var(--radius-sm, 4px); padding: 0.35rem 0.5rem; margin-bottom: 0.35rem; }
.check-head { display: flex; gap: 0.4rem; align-items: baseline; }
.check-id { color: var(--accent); font-size: 0.66rem; }
.check-clause { color: var(--text-faint); font-size: 0.6rem; }
.check-statement { font-size: 0.68rem; margin: 0.15rem 0 0.3rem; }
.check-controls { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.check-marks { display: flex; gap: 0.2rem; }
.check-mark {
  background: none; border: 1px solid var(--border-soft); border-radius: 999px;
  color: var(--text-soft); cursor: pointer; font-size: 0.58rem; padding: 0.08rem 0.4rem;
}
.check-mark.satisfied.on { border-color: var(--sage); color: var(--sage); }
.check-mark.partial.on { border-color: #b45309; color: #b45309; }
.check-mark.not-evidenced.on { border-color: #b91c1c; color: #b91c1c; }
.check-evidence { flex: 1; min-width: 8rem; font-size: 0.64rem; }
</style>

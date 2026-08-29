<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useModelStore } from './stores/model';
import { useUiStore } from './stores/ui';
import { useMappingStore } from './stores/mapping';
import { useDiffStore } from './stores/diff';
import ModelTree from './components/ModelTree.vue';
import PageTree from './components/PageTree.vue';
import ProcessCanvas from './components/ProcessCanvas.vue';
import CodeEditor from './components/CodeEditor.vue';
import ElementInspector from './components/ElementInspector.vue';
import CompliancePanel from './components/CompliancePanel.vue';
import DataRegistry from './components/DataRegistry.vue';
import MappingView from './components/mapper/MapperView.vue';
import DiffView from './components/diff/DiffView.vue';
import SimulationPanel from './components/simulation/SimulationPanel.vue';
import ValidationPanel from './components/validation/ValidationPanel.vue';
import CommentPanel from './components/comments/CommentPanel.vue';
import MeasurementPanel from './components/measurement/MeasurementPanel.vue';
import ImportPanel from './components/ImportPanel.vue';
import SavePanel from './components/SavePanel.vue';
import NewModelDialog from './components/NewModelDialog.vue';
import OpenPackageDialog from './components/OpenPackageDialog.vue';
import { packageApiAvailable } from './lib/package';
import { useSimStore } from './stores/simulation';
import { unresolvedByElement } from './lib/comments';
import { validationSummary } from './lib/validation';
import { activePlugins } from './plugins';
import PalettePanel from './components/PalettePanel.vue';
import type { PaletteKind } from './lib/factory';
import { ref, inject } from 'vue';

const modelStore = useModelStore();
const ui = useUiStore();
const mappingStore = useMappingStore();
const diffStore = useDiffStore();
const importOpen = ref(false);

/** The viewer mode (Wave 4): one flag, consulted at the store (every
 *  mutation refuses) and here (the editing chrome hides). */
const readOnly = computed(() => modelStore.readOnly);

const brand = inject('brand', {
  name: 'Primmel',
  sub: 'Atelier',
  logoUrl: null as string | null,
});
const saveOpen = ref(false);
const newOpen = ref(false);
const packageOpen = ref(false);
/** The package API probe (Wave 1): the dev server answers, a static
 *  host 404s — the package chrome then stays hidden (the save probe's
 *  pattern). */
const packageApi = ref(false);
const openPanelId = ref<string | null>(null);

// ── The dirty discipline (TODO.editor/18) — Ctrl+S saves; leaving with
//    unsaved changes warns (dirty = history cursor ≠ saved cursor). ──
function onKeydown(e: KeyboardEvent) {
  if (readOnly.value) return; // the viewer has no save/new hotkeys
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveOpen.value = true;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    newOpen.value = true;
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (modelStore.dirty) e.preventDefault();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
  void packageApiAvailable().then((ok) => { packageApi.value = ok; });
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('beforeunload', onBeforeUnload);
});

/** The active plugins' panels (program conveniences, TODO.editor/17). */
const pluginPanels = computed(() => {
  void modelStore.version;
  return activePlugins(modelStore.standard).flatMap(p => p.panels ?? []);
});
const openPanel = computed(() => pluginPanels.value.find(p => p.id === openPanelId.value) ?? null);
const canvasRef = ref<InstanceType<typeof ProcessCanvas> | null>(null);

function onPalettePick(entry: PaletteKind) {
  canvasRef.value?.paletteAdd(entry);
}

function onPaletteDragStart(entry: PaletteKind, ev: DragEvent) {
  ev.dataTransfer?.setData('application/x-primmel-palette', JSON.stringify(entry));
}

const model = computed(() => modelStore.model);

// ── The validation badge (TODO.editor/29) — the kernel's verdict,
//    always visible: clean (green), warnings (amber), errors (red). ──
const validationPill = computed(() => {
  void modelStore.version;
  const s = validationSummary(modelStore.standard);
  if (s.errors > 0) return { num: s.errors, label: s.errors === 1 ? 'error' : 'errors', class: 'val-errors' };
  if (s.warnings > 0) return { num: s.warnings, label: s.warnings === 1 ? 'warning' : 'warnings', class: 'val-warnings' };
  return { num: '✓', label: 'valid', class: 'val-clean' };
});

// ── The simulation highlight (TODO.editor/13) — the current node in
//    accent, the walked trajectory dimmer, tooltips off. ─────────────
const simStore = useSimStore();

function simTint(id: string): string | null {
  const run = simStore.run;
  if (!run) return null;
  if (run.current?.nodeId === id) return '#5b6bc0';
  if (run.trajectory.some(t => t.nodeId === id)) return 'rgba(91, 107, 192, 0.45)';
  return null;
}

function simTooltip(): string | null {
  return null;
}

// ── The comment badge (TODO.editor/14) — unresolved count per node. ──
const commentBadges = computed(() => {
  void modelStore.version;
  const map = unresolvedByElement(modelStore.standard!);
  return (id: string) => {
    const n = map.get(id) ?? 0;
    return n > 0 ? String(n) : null;
  };
});

// Dev/e2e hook: the stores on window (probes read the AST directly
// instead of spelunking the DOM). Never in production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __stores: unknown }).__stores = { model: modelStore, ui, mapping: mappingStore, diff: diffStore };
}

type ViewMode = 'model' | 'registry' | 'mapping' | 'diff';
const view = computed<ViewMode>({
  get: () => ui.view as ViewMode,
  set: (v) => { ui.view = v; },
});
</script>

<template>
  <div class="atelier">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">
          <img v-if="brand.logoUrl" :src="brand.logoUrl" alt="" width="28" height="28" />
          <svg v-else width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
            <path d="M8 18 L8 10 L14 18 L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="20" cy="10" r="2" fill="currentColor"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">{{ brand.name }}</span>
          <span class="brand-sub" v-if="brand.sub">{{ brand.sub }}</span>
        </div>
      </div>

      <div class="stats-bar" v-if="model">
        <div class="stat-pill">
          <span class="stat-num">{{ model.processes.length }}</span>
          <span class="stat-label">processes</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">{{ model.provisions.length }}</span>
          <span class="stat-label">provisions</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">{{ model.pages.length }}</span>
          <span class="stat-label">canvases</span>
        </div>
        <div class="stat-pill" v-if="modelStore.pkg" data-testid="package-pill">
          <span class="stat-num">{{ modelStore.pkg.files.length }}</span>
          <span class="stat-label">files · {{ modelStore.pkg.id }}</span>
        </div>
        <div class="stat-pill" v-if="readOnly" data-testid="readonly-badge">
          <span class="stat-label">read only</span>
        </div>
        <div class="stat-pill" v-if="modelStore.parseError">
          <span class="stat-num error">!</span>
          <span class="stat-label">error</span>
        </div>
        <div class="stat-pill" v-else :class="validationPill.class" data-testid="validation-badge">
          <span class="stat-num">{{ validationPill.num }}</span>
          <span class="stat-label">{{ validationPill.label }}</span>
        </div>
      </div>

      <nav class="panel-nav">
        <div class="nav-group view-switcher">
          <button
            :class="{ active: view === 'model' }"
            @click="view = 'model'"
          >Model</button>
          <button
            :class="{ active: view === 'registry' }"
            @click="view = 'registry'"
          >Registry</button>
          <button
            :class="{ active: view === 'mapping' }"
            @click="view = 'mapping'"
          >Mapping</button>
          <button
            :class="{ active: view === 'diff' }"
            @click="view = 'diff'"
          >Diff</button>
          <template v-if="!readOnly">
            <span class="nav-sep"></span>
            <button data-testid="open-new" @click="newOpen = true">New</button>
            <button
              v-if="packageApi"
              data-testid="open-package"
              @click="packageOpen = true"
            >Open pkg</button>
            <button
              class="save-nav-btn"
              :class="{ dirty: modelStore.dirty }"
              data-testid="open-save"
              @click="saveOpen = true"
            >Save<span v-if="modelStore.dirty" class="dirty-dot" data-testid="dirty-dot" /></button>
            <button data-testid="open-import" @click="importOpen = true">Import</button>
          </template>
          <button
            v-for="panel in pluginPanels"
            :key="panel.id"
            :data-testid="`open-panel-${panel.id}`"
            @click="openPanelId = openPanelId === panel.id ? null : panel.id"
          >{{ panel.label }}</button>
        </div>
        <template v-if="view === 'model'">
          <span class="nav-sep"></span>
          <div class="nav-group">
            <button
              :class="{ active: ui.leftPanel === 'tree' }"
              @click="ui.leftPanel = 'tree'"
            >Tree</button>
            <button
              :class="{ active: ui.leftPanel === 'code' }"
              @click="ui.leftPanel = 'code'"
            >Code</button>
          </div>
          <span class="nav-sep"></span>
          <div class="nav-group">
            <button
              :class="{ active: ui.rightPanel === 'inspector' }"
              @click="ui.rightPanel = 'inspector'"
            >Inspect</button>
            <button
              :class="{ active: ui.rightPanel === 'compliance' }"
              @click="ui.rightPanel = 'compliance'"
            >Compliance</button>
            <button
              :class="{ active: ui.rightPanel === 'simulation' }"
              @click="ui.rightPanel = 'simulation'"
            >Simulate</button>
            <button
              :class="{ active: ui.rightPanel === 'validation' }"
              data-testid="tab-validation"
              @click="ui.rightPanel = 'validation'"
            >Validate</button>
          </div>
        </template>
      </nav>
    </header>

    <template v-if="view === 'model' && model">
      <main class="workspace">
        <aside class="panel panel-left">
          <PalettePanel v-if="!readOnly" :model="model" @pick="onPalettePick" @dragstart="onPaletteDragStart" />
          <PageTree :model="model" />
          <Transition name="fade" mode="out-in">
            <ModelTree v-if="ui.leftPanel === 'tree'" :model="model" key="tree" />
            <CodeEditor v-else key="code" />
          </Transition>
        </aside>

        <section class="panel panel-center">
          <ProcessCanvas ref="canvasRef" :model="model" :tint-of="simTint" :tooltip-of="simTooltip" :tick="simStore.run" :badge-of="commentBadges" />
        </section>

        <aside class="panel panel-right">
          <Transition name="fade" mode="out-in">
            <!-- The viewer keeps the inspector as a READ-ONLY summary:
                 the disabled fieldset switches every field and button
                 inside off (store-level, the commands refuse too). -->
            <fieldset v-if="ui.rightPanel === 'inspector'" class="inspector-frame" :disabled="readOnly" key="inspector">
              <ElementInspector :model="model" />
            </fieldset>
            <CompliancePanel v-else-if="ui.rightPanel === 'compliance'" :model="model" key="compliance" />
            <SimulationPanel v-else-if="ui.rightPanel === 'simulation'" :model="model" key="simulation" />
            <ValidationPanel v-else :model="model" key="validation" />
          </Transition>
          <CommentPanel v-if="ui.rightPanel === 'inspector'" :model="model" />
          <MeasurementPanel v-if="ui.rightPanel === 'inspector'" :model="model" />
        </aside>
      </main>
    </template>

    <template v-else-if="view === 'registry' && model">
      <main class="workspace workspace-registry">
        <DataRegistry :model="model" />
      </main>
    </template>

    <template v-else-if="view === 'mapping' && model">
      <main class="workspace workspace-mapping">
        <MappingView :implementation-model="model" />
      </main>
    </template>

    <template v-else-if="view === 'diff' && model">
      <main class="workspace workspace-diff">
        <DiffView :model="model" />
      </main>
    </template>

    <div v-else class="workspace error-state">
      <aside class="panel panel-left"><CodeEditor /></aside>
      <section class="panel panel-center">
        <div class="error-card">
          <div class="error-glyph">⚠</div>
          <h3>Parse error</h3>
          <pre>{{ modelStore.parseError }}</pre>
          <p>Fix the syntax in the editor to see the visual model.</p>
        </div>
      </section>
      <aside class="panel panel-right"></aside>
    </div>

    <ImportPanel v-if="importOpen && !readOnly" @close="importOpen = false" />
    <SavePanel v-if="saveOpen && model && !readOnly" :model="model" @close="saveOpen = false" />
    <NewModelDialog v-if="newOpen && !readOnly" @close="newOpen = false" />
    <OpenPackageDialog v-if="packageOpen && !readOnly" @close="packageOpen = false" />

    <div v-if="openPanel" class="panel-modal-backdrop" @click.self="openPanelId = null">
      <div class="panel-modal" :data-testid="`panel-${openPanel.id}`">
        <div class="panel-modal-head">
          <span>{{ openPanel.label }}</span>
          <button type="button" @click="openPanelId = null">✕</button>
        </div>
        <component :is="openPanel.component" :model="model" />
      </div>
    </div>
  </div>
</template>

<style>
.atelier {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    radial-gradient(ellipse at top left, rgba(212, 148, 66, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(184, 85, 85, 0.03) 0%, transparent 50%),
    var(--bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0 1.25rem;
  height: 56px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  flex-shrink: 0;
  position: relative;
}

.topbar::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
  opacity: 0.4;
}

.brand { display: flex; align-items: center; gap: 0.65rem; }
.brand-mark {
  color: var(--accent);
  display: flex;
  align-items: center;
  filter: drop-shadow(0 0 6px var(--accent-glow));
}
.brand-text { display: flex; flex-direction: column; line-height: 1; }
.brand-name {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 400;
  color: var(--text);
  letter-spacing: 0.01em;
}
.brand-sub {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  margin-top: 2px;
}

.stats-bar { display: flex; gap: 0.5rem; flex: 1; justify-content: center; }
.stat-pill {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.2rem 0.65rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  border-radius: 100px;
  transition: var(--transition);
}
.stat-pill:hover { border-color: var(--accent); background: var(--bg-hover); }
.stat-num {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}
.stat-num.error { color: var(--burgundy); }
.stat-pill.val-clean .stat-num { color: var(--sage); }
.stat-pill.val-warnings .stat-num { color: #d49442; }
.stat-pill.val-errors .stat-num { color: #b85555; }
.stat-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: lowercase;
}

.panel-nav { display: flex; align-items: center; gap: 0.5rem; }
.nav-group {
  display: flex;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 2px;
}
.nav-group button {
  padding: 0.3rem 0.7rem;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: var(--transition);
}
.nav-group button:hover { color: var(--text-soft); }
.nav-group button.active {
  background: var(--accent);
  color: var(--bg);
  box-shadow: var(--shadow-sm);
}
.nav-sep { width: 1px; height: 20px; background: var(--border); }

.workspace {
  display: grid;
  grid-template-columns: 260px 1fr 300px;
  flex: 1;
  overflow: hidden;
  gap: 1px;
  background: var(--border-soft);
}

.panel {
  background: var(--bg-surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.panel-left, .panel-right { border-bottom: none; }

/* The viewer's read-only inspector frame: fill the panel, no fieldset chrome. */
.inspector-frame {
  border: none;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.error-state .panel-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-card {
  max-width: 480px;
  padding: 2rem;
  text-align: center;
}
.error-glyph {
  font-size: 2.5rem;
  color: var(--burgundy);
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 0 12px var(--burgundy-soft));
}
.error-card h3 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--burgundy);
  margin-bottom: 0.75rem;
}
.error-card pre {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-align: left;
  background: var(--burgundy-soft);
  border: 1px solid var(--burgundy);
  border-radius: var(--radius);
  padding: 0.75rem;
  color: var(--text-soft);
  white-space: pre-wrap;
  margin-bottom: 0.75rem;
}
.error-card p { color: var(--text-muted); font-size: 0.85rem; }

.save-nav-btn { position: relative; }
.save-nav-btn.dirty { color: var(--accent); }
.dirty-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: 0.3rem;
  vertical-align: middle;
}

.panel-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.panel-modal {
  width: 34rem;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.panel-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  font-weight: 600;
}
.panel-modal-head button {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>

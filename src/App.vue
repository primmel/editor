<script setup lang="ts">
import { computed } from 'vue';
import { useModelStore } from './stores/model';
import { useUiStore } from './stores/ui';
import ModelTree from './components/ModelTree.vue';
import ProcessCanvas from './components/ProcessCanvas.vue';
import CodeEditor from './components/CodeEditor.vue';
import ElementInspector from './components/ElementInspector.vue';
import CompliancePanel from './components/CompliancePanel.vue';

const modelStore = useModelStore();
const ui = useUiStore();

const model = computed(() => modelStore.model);
</script>

<template>
  <div class="atelier">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
            <path d="M8 18 L8 10 L14 18 L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="20" cy="10" r="2" fill="currentColor"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name">Primmel</span>
          <span class="brand-sub">Atelier</span>
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
        <div class="stat-pill" v-if="modelStore.parseError">
          <span class="stat-num error">!</span>
          <span class="stat-label">error</span>
        </div>
      </div>

      <nav class="panel-nav">
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
        </div>
      </nav>
    </header>

    <main class="workspace" v-if="model">
      <aside class="panel panel-left">
        <Transition name="fade" mode="out-in">
          <ModelTree v-if="ui.leftPanel === 'tree'" :model="model" key="tree" />
          <CodeEditor v-else key="code" />
        </Transition>
      </aside>

      <section class="panel panel-center">
        <ProcessCanvas :model="model" />
      </section>

      <aside class="panel panel-right">
        <Transition name="fade" mode="out-in">
          <ElementInspector v-if="ui.rightPanel === 'inspector'" :model="model" key="inspector" />
          <CompliancePanel v-else :model="model" key="compliance" />
        </Transition>
      </aside>
    </main>

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

.fade-enter-active, .fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>

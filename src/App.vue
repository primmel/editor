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
  <div class="app">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-mark">Primmel</span>
        <span class="brand-sub">Editor</span>
      </div>
      <nav class="top-nav" v-if="model">
        <button
          :class="{ active: ui.leftPanel === 'tree' }"
          @click="ui.leftPanel = 'tree'"
        >Tree</button>
        <button
          :class="{ active: ui.leftPanel === 'code' }"
          @click="ui.leftPanel = 'code'"
        >Code</button>
        <span class="nav-divider"></span>
        <button
          :class="{ active: ui.rightPanel === 'inspector' }"
          @click="ui.rightPanel = 'inspector'"
        >Inspector</button>
        <button
          :class="{ active: ui.rightPanel === 'compliance' }"
          @click="ui.rightPanel = 'compliance'"
        >Compliance</button>
      </nav>
    </header>

    <main class="workspace" v-if="model">
      <aside class="panel-left">
        <ModelTree v-show="ui.leftPanel === 'tree'" :model="model" />
        <CodeEditor v-show="ui.leftPanel === 'code'" />
      </aside>

      <section class="panel-center">
        <ProcessCanvas :model="model" />
      </section>

      <aside class="panel-right">
        <ElementInspector v-show="ui.rightPanel === 'inspector'" :model="model" />
        <CompliancePanel v-show="ui.rightPanel === 'compliance'" :model="model" />
      </aside>
    </main>

    <div v-else class="workspace">
      <aside class="panel-left">
        <CodeEditor />
      </aside>
      <section class="panel-center">
        <div class="parse-error">
          <h3>Parse error</h3>
          <pre>{{ modelStore.parseError }}</pre>
          <p>Fix the error in the editor to see the model.</p>
        </div>
      </section>
      <aside class="panel-right"></aside>
    </div>
  </div>
</template>

<style>
:root {
  --accent: #4a6fa5;
  --bg: #fff;
  --bg-soft: #fafafa;
  --bg-panel: #fff;
  --border: #e0e0e0;
  --text: #222;
  --text-soft: #666;
  --text-muted: #999;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
}

.app { display: flex; flex-direction: column; height: 100%; }

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 48px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.brand { display: flex; align-items: baseline; gap: 0.35rem; }
.brand-mark { font-weight: 700; font-size: 1.1rem; color: var(--accent); }
.brand-sub { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

.top-nav { display: flex; align-items: center; gap: 0.15rem; }
.top-nav button {
  padding: 0.25rem 0.7rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-soft);
  border-radius: 3px;
}
.top-nav button:hover { background: var(--bg-soft); }
.top-nav button.active { background: var(--accent); color: #fff; }
.nav-divider { width: 1px; height: 20px; background: var(--border); margin: 0 0.5rem; }

.workspace {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  flex: 1;
  overflow: hidden;
}
.panel-left, .panel-right {
  border-right: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-right { border-right: none; border-left: 1px solid var(--border); }
.panel-center { overflow: hidden; position: relative; }

.parse-error {
  padding: 2rem;
  color: var(--text-soft);
}
.parse-error h3 { color: #c00; margin-bottom: 0.5rem; }
.parse-error pre {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.82rem;
  background: #fee;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #fcc;
  margin: 0.5rem 0;
  white-space: pre-wrap;
}
</style>

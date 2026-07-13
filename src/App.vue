<script setup lang="ts">
import { ref, computed } from 'vue';
import { load, dump, type Standard } from '@primmel/primmel';

const rawContent = ref(`root HelloWorld

version "v1.0.0-dev1"

metadata {
  title "Hello World"
  schema "Primmel 0.1"
  namespace "HelloWorld"
}

role Greeter { name "Greeter" }

start_event Start { }
end_event Done { }

process Greet {
  name "Greet the world"
  actor Greeter
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Greet { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to Greet }
    E2 { from Greet to Done }
  }
}`);

const model = computed(() => {
  try {
    return load(rawContent.value);
  } catch (e) {
    return null;
  }
});

const error = computed(() => {
  try { load(rawContent.value); return null; }
  catch (e) { return (e as Error).message; }
});

function formatModel() {
  if (!model.value) return;
  rawContent.value = dump(model.value);
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        <img src="/primmel-logo-light.svg" alt="Primmel" width="24" height="24" />
        <span>Primmel Editor</span>
      </div>
      <button @click="formatModel" class="btn">Format</button>
    </header>
    <main class="workspace">
      <aside class="sidebar">
        <h3>Model Tree</h3>
        <template v-if="model">
          <div v-if="model.roles.length" class="tree-group">
            <span class="tree-label">Roles ({{ model.roles.length }})</span>
          </div>
          <div v-if="model.processes.length" class="tree-group">
            <span class="tree-label">Processes ({{ model.processes.length }})</span>
          </div>
          <div v-if="model.provisions.length" class="tree-group">
            <span class="tree-label">Provisions ({{ model.provisions.length }})</span>
          </div>
          <div v-if="model.pages.length" class="tree-group">
            <span class="tree-label">Canvases ({{ model.pages.length }})</span>
          </div>
          <div v-if="model.events.length" class="tree-group">
            <span class="tree-label">Events ({{ model.events.length }})</span>
          </div>
        </template>
        <p v-else class="tree-empty">No model loaded</p>
      </aside>
      <section class="editor">
        <textarea v-model="rawContent" class="code-input" spellcheck="false"></textarea>
        <div v-if="error" class="error-bar">{{ error }}</div>
      </section>
      <aside class="preview">
        <h3>Summary</h3>
        <template v-if="model">
          <dl class="stats">
            <dt>Root</dt><dd><code>{{ model.root?.id ?? '—' }}</code></dd>
            <dt>Title</dt><dd>{{ model.meta?.title ?? '—' }}</dd>
            <dt>Roles</dt><dd>{{ model.roles.length }}</dd>
            <dt>Processes</dt><dd>{{ model.processes.length }}</dd>
            <dt>Provisions</dt><dd>{{ model.provisions.length }}</dd>
            <dt>Events</dt><dd>{{ model.events.length }}</dd>
            <dt>Canvases</dt><dd>{{ model.pages.length }}</dd>
            <dt>References</dt><dd>{{ model.references.length }}</dd>
          </dl>
        </template>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; }
.toolbar {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.5rem 1rem; border-bottom: 1px solid #e0e0e0;
  background: #fff;
}
.brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
.btn {
  padding: 0.3rem 0.8rem; border: 1px solid #ccc; border-radius: 4px;
  background: #fff; cursor: pointer; font-size: 0.85rem;
}
.btn:hover { background: #f5f5f5; }
.workspace {
  display: grid; grid-template-columns: 200px 1fr 250px;
  flex: 1; overflow: hidden;
}
.sidebar, .preview {
  padding: 1rem; overflow-y: auto; border-right: 1px solid #e0e0e0;
  background: #fafafa;
}
.preview { border-right: none; border-left: 1px solid #e0e0e0; }
.sidebar h3, .preview h3 {
  font-size: 0.8rem; text-transform: uppercase; color: #888;
  margin-bottom: 0.75rem;
}
.tree-group { margin-bottom: 0.5rem; }
.tree-label { font-size: 0.85rem; color: #555; }
.tree-empty { color: #aaa; font-size: 0.85rem; }
.editor { display: flex; flex-direction: column; overflow: hidden; }
.code-input {
  flex: 1; border: none; padding: 1rem; font-family: 'SF Mono', Menlo, monospace;
  font-size: 0.82rem; line-height: 1.7; resize: none; outline: none;
  background: #fff; tab-size: 2;
}
.error-bar {
  padding: 0.5rem 1rem; background: #fee; color: #c00;
  font-family: monospace; font-size: 0.8rem; border-top: 1px solid #faa;
}
.stats { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.5rem; font-size: 0.82rem; }
.stats dt { color: #888; }
.stats dd { margin: 0; }
.stats code { font-family: monospace; font-size: 0.8rem; }
</style>

<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The package manifest panel (TODO.editor/40, the OIML plugin) — for
// a package-carrying model (a `package { … }` block, the
// package.primmel form): id/kind/uses/requires/provides rendered
// read-only, with the composed-package note (the oiml-cs uses chain:
// the scheme package composes the ISO/IEC 17xxx layers ahead of core,
// and each Recommendation composes oiml-cs in turn).
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useModelStore } from '../../stores/model';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();

const manifest = computed(() => {
  void modelStore.version;
  return props.model.packageManifest;
});

// The manifest's lists are optional in the type — render defaults.
const uses = computed(() => manifest.value?.uses ?? []);
const requires = computed(() => manifest.value?.requires ?? []);
const provides = computed(() => manifest.value?.provides ?? []);
</script>

<template>
  <div class="manifest-panel" data-testid="package-manifest-panel">
    <template v-if="manifest">
      <div class="manifest-head">
        <code class="manifest-id" data-testid="manifest-id">{{ manifest.id }}</code>
        <span class="manifest-kind" data-testid="manifest-kind">{{ manifest.kind }}</span>
      </div>
      <p class="manifest-title">{{ manifest.title }}</p>
      <p v-if="manifest.description" class="manifest-description">{{ manifest.description }}</p>

      <div class="manifest-columns">
        <div class="manifest-column" data-testid="manifest-uses">
          <h4>uses ({{ uses.length }})</h4>
          <ul><li v-for="u in uses" :key="u"><code>{{ u }}</code></li></ul>
        </div>
        <div class="manifest-column" data-testid="manifest-requires">
          <h4>requires ({{ requires.length }})</h4>
          <ul><li v-for="r in requires" :key="r"><code>{{ r }}</code></li></ul>
        </div>
        <div class="manifest-column" data-testid="manifest-provides">
          <h4>provides ({{ provides.length }})</h4>
          <ul><li v-for="p in provides" :key="p"><code>{{ p }}</code></li></ul>
        </div>
      </div>

      <p v-if="uses.length" class="manifest-note">
        This is a composed package: its <code>uses</code> chain layers the
        listed packages' content ahead of this one — the same chain each
        downstream consumer composes in turn.
      </p>
    </template>
    <p v-else class="manifest-empty">
      This model carries no package manifest. A package model declares one
      with a <code>package { … }</code> block (the package.primmel form).
    </p>
  </div>
</template>

<style scoped>
.manifest-panel { padding: 0.5rem 0.25rem; }
.manifest-head { display: flex; align-items: center; gap: 0.5rem; }
.manifest-id { font-family: var(--font-mono); font-size: 1rem; color: var(--accent); font-weight: 600; }
.manifest-kind {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-glow);
}
.manifest-title { font-size: 0.85rem; color: var(--text); margin: 0.5rem 0 0.25rem; }
.manifest-description {
  font-size: 0.72rem;
  color: var(--text-muted);
  max-height: 8rem;
  overflow-y: auto;
  margin: 0.25rem 0 0.75rem;
}
.manifest-columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.manifest-column h4 {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0 0 0.3rem;
}
.manifest-column ul { list-style: none; margin: 0; padding: 0; }
.manifest-column li { font-size: 0.72rem; padding: 0.1rem 0; }
.manifest-column code { font-family: var(--font-mono); color: var(--accent); }
.manifest-note { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.75rem; font-style: italic; }
.manifest-empty { font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 1rem 0.5rem; }
</style>

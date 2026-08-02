<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The profile switcher (TODO.editor/09) — the multi-reference lens:
// one badge per registered reference; click swaps the mapper's REF
// side (the auditor looks through ONE standard at a time). When the
// active reference has no profile yet, "seed from…" offers to start
// it from an existing profile (the review list shows after).
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import { seedProfileFrom } from '../../lib/multi-map';
import { useMappingStore } from '../../stores/mapping';
import { useModelStore } from '../../stores/model';

const mapping = useMappingStore();
const modelStore = useModelStore();

const profiles = computed(() => {
  void modelStore.version;
  return new Set(modelStore.standard?.mapProfiles.map(p => p.namespace) ?? []);
});

const seedSource = ref('');

function hasProfile(ns: string): boolean {
  return profiles.value.has(ns);
}

function seed(ns: string) {
  const refModel = mapping.refs[ns];
  if (!seedSource.value || !refModel) return;
  const { command, outcome } = seedProfileFrom(seedSource.value, ns, refModel);
  modelStore.execute(command);
  mapping.lastSeed = { fromNs: seedSource.value, toNs: ns, outcome };
  seedSource.value = '';
}

/** The namespaces available as a seed source (profiles the IMP holds,
 *  minus the target itself). */
function seedSourcesFor(ns: string): string[] {
  return [...profiles.value].filter(p => p !== ns).sort();
}
</script>

<template>
  <div class="profile-switcher" data-testid="profile-switcher">
    <span class="switcher-label">lens</span>
    <button
      v-for="ns in mapping.namespaces"
      :key="ns"
      type="button"
      class="switcher-badge"
      :class="{ active: mapping.activeNs === ns, 'no-profile': !hasProfile(ns) }"
      :data-testid="`lens-${ns}`"
      :title="hasProfile(ns) ? 'profile exists' : 'no profile yet — seed one below'"
      @click="mapping.activate(ns)"
    >
      {{ ns }}
      <span
        class="switcher-remove"
        :data-testid="`lens-remove-${ns}`"
        title="remove this reference"
        @click.stop="mapping.removeRef(ns)"
      >✕</span>
    </button>

    <template v-if="mapping.activeNs && !hasProfile(mapping.activeNs) && seedSourcesFor(mapping.activeNs).length">
      <span class="seed-label">seed from</span>
      <select v-model="seedSource" class="seed-select" data-testid="seed-source">
        <option value="">—</option>
        <option v-for="s in seedSourcesFor(mapping.activeNs)" :key="s" :value="s">{{ s }}</option>
      </select>
      <button
        type="button"
        class="seed-btn"
        :disabled="!seedSource"
        data-testid="seed-run"
        @click="seed(mapping.activeNs)"
      >seed</button>
    </template>
  </div>
</template>

<style scoped>
.profile-switcher {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.switcher-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}
.switcher-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.7rem;
}
.switcher-badge.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.switcher-badge.no-profile { border-style: dashed; }
.switcher-remove {
  color: var(--text-faint);
  font-size: 0.58rem;
}
.switcher-remove:hover { color: #b85555; }
.seed-label {
  font-size: 0.66rem;
  color: var(--text-muted);
  margin-left: 0.5rem;
}
.seed-select {
  padding: 0.15rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.68rem;
}
.seed-btn {
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.68rem;
}
.seed-btn:disabled { opacity: 0.4; cursor: default; }
</style>

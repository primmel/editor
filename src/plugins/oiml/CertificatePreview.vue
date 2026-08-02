<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The certificate preview (TODO.editor/17) — the model's instrument
// subjects rendered as certificate-style characteristic tables
// (IS identity/design parameters, HAS exhibited attributes and
// characteristics, the promises). Read-only.
// ─────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { useModelStore } from '../../stores/model';

const props = defineProps<{ model: Standard }>();
const modelStore = useModelStore();

const subjects = computed(() => {
  void modelStore.version;
  return props.model.subjects;
});

function entries(rec: Record<string, string>): { key: string; value: string }[] {
  return Object.entries(rec).map(([key, value]) => ({ key, value }));
}
</script>

<template>
  <div class="cert-preview" data-testid="certificate-preview">
    <div v-if="!subjects.length" class="cert-empty">
      no instrument subjects declared — the palette's Instrument entry creates one
    </div>

    <div v-for="s in subjects" :key="s.id" class="cert-card" :data-testid="`cert-${s.id}`">
      <div class="cert-head">
        <span class="cert-title">instrument certificate — preview</span>
        <code class="cert-id">{{ s.id }}</code>
      </div>

      <div v-if="entries(s.is.metadata).length" class="cert-section">
        <div class="cert-label">identity</div>
        <div v-for="e in entries(s.is.metadata)" :key="e.key" class="cert-row">
          <span class="cert-key">{{ e.key }}</span>
          <span class="cert-value">{{ e.value }}</span>
        </div>
      </div>

      <div v-if="entries(s.is.designParameters).length" class="cert-section">
        <div class="cert-label">design parameters</div>
        <div v-for="e in entries(s.is.designParameters)" :key="e.key" class="cert-row">
          <span class="cert-key">{{ e.key }}</span>
          <span class="cert-value">{{ e.value }}</span>
        </div>
      </div>

      <div v-if="entries(s.has.attributes).length" class="cert-section">
        <div class="cert-label">characteristics</div>
        <div v-for="e in entries(s.has.attributes)" :key="e.key" class="cert-row">
          <span class="cert-key">{{ e.key }}</span>
          <span class="cert-value">{{ e.value }}</span>
        </div>
      </div>

      <div v-if="s.is.promises.length" class="cert-section">
        <div class="cert-label">promises</div>
        <div v-for="(p, i) in s.is.promises" :key="i" class="cert-row">
          <span class="cert-value">{{ p.statement ?? p.target ?? '—' }}</span>
        </div>
      </div>

      <div v-if="s.does.behaviors.length" class="cert-section">
        <div class="cert-label">behaviors</div>
        <div v-for="b in s.does.behaviors" :key="b" class="cert-row">
          <span class="cert-key">{{ b }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cert-preview { padding: 0.75rem; overflow-y: auto; height: 100%; }
.cert-empty {
  color: var(--text-faint);
  font-size: 0.74rem;
  font-style: italic;
  padding: 1rem;
  text-align: center;
}
.cert-card {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  margin-bottom: 0.8rem;
  background: var(--bg-surface);
}
.cert-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.cert-title {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.cert-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
}
.cert-section { padding: 0.35rem 0.75rem; }
.cert-label {
  font-family: var(--font-mono);
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  padding: 0.2rem 0;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 0.15rem;
}
.cert-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.12rem 0;
  font-size: 0.72rem;
}
.cert-key {
  font-family: var(--font-mono);
  color: var(--text-muted);
}
.cert-value { color: var(--text); text-align: right; }
</style>

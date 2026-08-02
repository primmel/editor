<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The automap panel (TODO.editor/11) — ranked mapping SUGGESTIONS
// (never asserted): confirm lands the pair with the provenance
// justification; reject remembers for the session. Below, the
// KERNEL's closure proposals (computeCoverage's own DiscoveryProposal
// list), flagged as proposals — confirm asserts them too.
// ─────────────────────────────────────────────────────────────────────
import { computed, ref } from 'vue';
import type { Standard } from '@primmel/primmel';
import { automapJustification, suggestMappings, type AutomapSuggestion } from '../../lib/automap';
import { coverageView } from '../../lib/coverage';
import { targetRef } from '../../lib/mapper';
import { createMappingPair } from '../../lib/commands';
import { useModelStore } from '../../stores/model';
import { useMappingStore } from '../../stores/mapping';

const props = defineProps<{
  implementationModel: Standard;
  referenceModel: Standard;
  namespace: string;
}>();

const modelStore = useModelStore();
const mapping = useMappingStore();

const suggestions = computed(() => {
  void modelStore.version;
  void mapping.rejectedPairs.size; // rejections re-filter
  return suggestMappings(props.implementationModel, props.referenceModel, props.namespace, {
    skip: mapping.rejectedPairs,
    limit: 15,
  });
});

/** The KERNEL's closure proposals (all children covered ⇒ the parent
 *  is proposed — flagged, never asserted). */
const proposals = computed(() => {
  void modelStore.version;
  return coverageView(props.implementationModel, props.referenceModel, props.namespace)
    .report.proposals;
});

function confirm(s: AutomapSuggestion) {
  modelStore.execute(createMappingPair(
    props.namespace,
    s.impId,
    targetRef(props.namespace, s.refId),
    {
      description: s.reasons.join('; '),
      justification: automapJustification(s),
    },
  ));
}

function reject(s: AutomapSuggestion) {
  mapping.rejectPair(s.impId, s.refId);
}

function confirmProposal(source: string, target: string) {
  modelStore.execute(createMappingPair(
    props.namespace,
    source,
    target,
    { description: 'closure proposal (all children covered)', justification: 'kernel proposal, confirmed by operator' },
  ));
}

const open = ref(true);
</script>

<template>
  <div class="automap" data-testid="automap-panel">
    <button type="button" class="automap-toggle" data-testid="automap-toggle" @click="open = !open">
      {{ open ? '▾' : '▸' }} automap ({{ suggestions.length }} suggestions<span v-if="proposals.length">, {{ proposals.length }} proposals</span>)
    </button>

    <div v-if="open" class="automap-body">
      <div v-if="!suggestions.length && !proposals.length" class="automap-empty">
        no suggestions above the threshold
      </div>

      <div
        v-for="s in suggestions"
        :key="`${s.impId}|${s.refId}`"
        class="suggestion-row"
        :data-testid="`suggestion-${s.impId}-${s.refId}`"
      >
        <span class="suggestion-pair">
          <code>{{ s.impId }}</code> ⇒ <code>{{ s.refId }}</code>
        </span>
        <span class="suggestion-score">
          <span class="score-bar" :style="{ width: `${Math.round(s.score * 100)}%` }" />
          <span class="score-num">{{ s.score.toFixed(2) }}</span>
        </span>
        <span class="suggestion-reasons">{{ s.reasons.join(' · ') }}</span>
        <button
          type="button"
          class="suggestion-confirm"
          :data-testid="`confirm-${s.impId}-${s.refId}`"
          @click="confirm(s)"
        >confirm</button>
        <button
          type="button"
          class="suggestion-reject"
          :data-testid="`reject-${s.impId}-${s.refId}`"
          @click="reject(s)"
        >✕</button>
      </div>

      <template v-if="proposals.length">
        <div class="proposal-header">closure proposals (kernel-flagged, never asserted)</div>
        <div
          v-for="p in proposals"
          :key="`${p.source}⇒${p.target}`"
          class="suggestion-row proposal"
          :data-testid="`proposal-${p.source}`"
        >
          <span class="suggestion-pair">
            <code>{{ p.source }}</code> ⇒ <code>{{ p.target }}</code>
          </span>
          <span class="suggestion-reasons" :title="p.rationale">{{ p.kind }} · via {{ p.via.join(', ') }}</span>
          <button
            type="button"
            class="suggestion-confirm"
            :data-testid="`confirm-proposal-${p.source}`"
            @click="confirmProposal(p.source, p.target)"
          >confirm</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.automap {
  border-bottom: 1px solid var(--border);
}
.automap-toggle {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  color: var(--text-muted);
}
.automap-toggle:hover { color: var(--accent); }
.automap-body {
  max-height: 220px;
  overflow-y: auto;
  padding: 0.15rem 0.75rem 0.5rem;
}
.automap-empty {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-style: italic;
  padding: 0.3rem 0;
}
.suggestion-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.22rem 0;
  font-size: 0.72rem;
}
.suggestion-pair {
  font-family: var(--font-mono);
  color: var(--text);
  white-space: nowrap;
}
.suggestion-score {
  position: relative;
  width: 90px;
  height: 12px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.score-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  opacity: 0.55;
}
.score-num {
  position: relative;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  color: var(--text);
  padding-left: 0.25rem;
  line-height: 12px;
}
.suggestion-reasons {
  flex: 1;
  font-size: 0.64rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggestion-confirm {
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.64rem;
  padding: 0.12rem 0.5rem;
}
.suggestion-reject {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.64rem;
  padding: 0.1rem 0.25rem;
}
.suggestion-reject:hover { color: #b85555; }
.proposal-header {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  padding: 0.4rem 0 0.15rem;
  border-top: 1px dashed var(--border);
  margin-top: 0.3rem;
}
.suggestion-row.proposal .suggestion-pair code { color: var(--sage); }
</style>

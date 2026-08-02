<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────
// The coverage legend (TODO.editor/08) — the extension's tint legend:
// full = green, minimal = teal, partial = amber, none = slate; the
// conflict marker (C23) and the IMP-side mapped/unmapped.
// ─────────────────────────────────────────────────────────────────────
import { COVERAGE_TINTS } from '../../lib/coverage';
</script>

<template>
  <div class="coverage-legend" data-testid="coverage-legend">
    <span class="legend-item">
      <span class="legend-dot" :style="{ background: COVERAGE_TINTS.full }" /> full
    </span>
    <span class="legend-item">
      <span class="legend-dot" :style="{ background: COVERAGE_TINTS.minimal }" /> minimal
    </span>
    <span class="legend-item">
      <span class="legend-dot" :style="{ background: COVERAGE_TINTS.partial }" /> partial
    </span>
    <span class="legend-item">
      <span class="legend-dot" :style="{ background: COVERAGE_TINTS.none }" /> none
    </span>
    <span class="legend-sep" />
    <span class="legend-item">
      <span class="legend-dot conflict" /> asserted ≠ computed (C23)
    </span>
  </div>
</template>

<style scoped>
.coverage-legend {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.25rem 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.legend-item { display: flex; align-items: center; gap: 0.25rem; }
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
.legend-dot.conflict {
  background: transparent;
  border: 2px solid #b85555;
}
.legend-sep {
  width: 1px;
  height: 12px;
  background: var(--border);
}
</style>

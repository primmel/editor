#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# The e2e suite (TODO.editor/19) — every leg, in order, against the
# dev server (npm run dev on :5173). Any leg's failure stops the run.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

for leg in \
  leg1-create-edit-serialize \
  palette-smoke \
  inspector-smoke \
  data-editors-smoke \
  pages-smoke \
  mapper-smoke \
  coverage-smoke \
  multi-map-smoke \
  document-smoke \
  automap-smoke \
  diff-smoke \
  simulation-smoke \
  monaco-smoke \
  new-model-smoke \
  data-section-smoke \
  comments-smoke \
  measurement-smoke \
  import-smoke \
  plugin-smoke \
  capability-walk \
  r7-smoke \
  oiml-cs-smoke \
  scale-smoke \
  save-smoke
do
  echo "── $leg"
  npx tsx "e2e/$leg.ts" | tail -1
done

echo "ALL E2E LEGS GREEN"

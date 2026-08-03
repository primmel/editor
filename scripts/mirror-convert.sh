#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# The mirror converter (TODO.editor/37) — presentation XML → Mirror
# JSON via metanorma-document's to-mirror, in the isolated bundle.
#
# Usage: scripts/mirror-convert.sh <presentation.xml> <output.mirror.json>
#
# The flavor rule (discovered): the converter infers the document
# flavor from the input's BASENAME — `document.*` maps to the abstract
# 'document' flavor and fails; a `iso-` prefix maps to the concrete
# iso flavor whose Root parses the <metanorma> root. The copy goes to
# a temp name with that prefix, converted, removed.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

INPUT="$1"
OUTPUT="$2"
ENV_DIR="$(cd "$(dirname "$0")/mirror-env" && pwd)"

if [ ! -f "$ENV_DIR/Gemfile.lock" ]; then
  echo "mirror-env: installing the bundle (first run)…" >&2
  (cd "$ENV_DIR" && bundle install --quiet)
fi

# The output must be absolute before the bundle's cd.
case "$OUTPUT" in
  /*) ;;
  *) OUTPUT="$(pwd)/$OUTPUT" ;;
esac
mkdir -p "$(dirname "$OUTPUT")"

TMP="$(mktemp -d)/iso-input.xml"
cp "$INPUT" "$TMP"

(cd "$ENV_DIR" && bundle exec metanorma-document to-mirror "$TMP" -o "$OUTPUT" 2>/dev/null)

# The mirror output carries no docidentifier — embed it (and the
# bibdata date) from the source XML so the fixture is self-contained
# (the URN mint needs it).
node -e "
const fs = require('fs');
const xml = fs.readFileSync('$INPUT', 'utf8');
const docid = (xml.match(/<docidentifier[^>]*>([^<]+)/) ?? [])[1] ?? 'document';
const date = (xml.match(/<date[^>]*>\s*<on>([0-9-]+)/) ?? [])[1] ?? '';
const doc = JSON.parse(fs.readFileSync('$OUTPUT', 'utf8'));
doc.attrs = doc.attrs ?? {};
doc.attrs.docidentifier = docid.trim();
doc.attrs.bibdataDate = date;
fs.writeFileSync('$OUTPUT', JSON.stringify(doc, null, 2));
"

# The honest check: the JSON parses and carries text leaves.
node -e "
const fs = require('fs');
const doc = JSON.parse(fs.readFileSync('$OUTPUT', 'utf8'));
let texts = 0;
const walk = (n) => {
  if (n.type === 'text' && typeof n.text === 'string' && n.text.trim()) texts++;
  (Array.isArray(n.content) ? n.content : []).forEach(walk);
};
walk(doc);
if (texts === 0) {
  console.error('mirror-convert: no text content in the output — refusing');
  process.exit(1);
}
console.error('mirror-convert: ' + texts + ' text leaves');
"

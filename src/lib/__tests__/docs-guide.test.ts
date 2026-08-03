// ─────────────────────────────────────────────────────────────────────
// TODO.editor/30 — the guide's honesty check: every testid, route,
// and diagram the guide names exists in the shipped app (never a
// stale manual), and every referenced diagram is well-formed.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const docsDir = join(__dirname, '../../../docs');
const pages = readdirSync(docsDir).filter(f => f.endsWith('.md'));
const guide = pages
  .map(f => readFileSync(join(docsDir, f), 'utf8'))
  .join('\n')
  .replace(/\s+/g, ' ');

const srcDir = join(__dirname, '../..');
const sources = [
  'App.vue',
  'components/ProcessCanvas.vue',
  'components/ModelTree.vue',
  'components/PageTree.vue',
  'components/PalettePanel.vue',
  'components/ElementInspector.vue',
  'components/CodeEditor.vue',
  'components/ImportPanel.vue',
  'components/SavePanel.vue',
  'components/NewModelDialog.vue',
  'components/mapper/MapperView.vue',
  'components/mapper/MapPairDialog.vue',
  'components/mapper/AutoMapPanel.vue',
  'components/mapper/DocumentView.vue',
  'components/mapper/ProfileSwitcher.vue',
  'components/simulation/SimulationPanel.vue',
  'components/measurement/MeasurementPanel.vue',
  'components/comments/CommentPanel.vue',
  'components/validation/ValidationPanel.vue',
  'components/inspectors/ProcessInspector.vue',
  'components/inspectors/RegistryInspector.vue',
  'components/inspectors/DataClassInspector.vue',
  'components/inspectors/EnumInspector.vue',
  'components/fields/AttributeList.vue',
].map(f => readFileSync(join(srcDir, f), 'utf8')).join('\n');

/** The testids the guide names must exist in the app (palette ids are
 *  template-generated — checked as patterns). */
const NAMED_TESTIDS = [
  'open-new', 'open-save', 'open-import', 'tab-validation',
  'validation-badge',
  'inspector-name', 'inspector-actor', 'inspector-new-page',
  'canvas-breadcrumb', 'sim-start', 'sim-continue',
  'pair-confirm', 'pair-description', 'map-overlay',
  'save-panel', 'import-panel', 'validation-panel',
  'registry-data-class', 'attr-add-input',
];

const PALETTE_PATTERN = 'data-testid="`palette-${entry.kind}';

describe('30 — the guide is honest to the shipped app', () => {
  it('every testid the guide relies on exists in the app source', () => {
    for (const id of NAMED_TESTIDS) {
      expect(sources, `missing testid ${id}`).toContain(`data-testid="${id}"`);
    }
    // The palette's generated ids (palette-process, palette-dataclass, …).
    expect(sources).toContain(PALETTE_PATTERN);
  });

  it('every diagram the guide references exists and is well-formed SVG', () => {
    const refs = [...guide.matchAll(/diagrams\/([a-z-]+\.svg)/g)].map(m => m[1]);
    expect(refs.length).toBeGreaterThan(5);
    for (const ref of new Set(refs)) {
      const svg = readFileSync(join(docsDir, 'diagrams', ref!), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    }
  });

  it('every guide page exists for the audience map', () => {
    const expected = [
      'README.md', 'quickstart.md', 'the-workspace.md', 'modelling.md',
      'mapping.md', 'review-and-save.md', 'importing-legacy.md',
      'authoring-oiml.md', 'glossary.md',
    ];
    for (const f of expected) {
      expect(pages, `missing ${f}`).toContain(f);
    }
  });

  it('the guide names the honest walls (ephemeral, scratch, never reimplemented)', () => {
    expect(guide).toContain('ephemeral');
    expect(guide).toContain('never persist into the model');
    expect(guide).toContain('authoring scratch');
    expect(guide).toContain('never reimplement');
  });
});

// ─────────────────────────────────────────────────────────────────────
// TODO.editor/17 — the plugin architecture's proofs:
//   - the registry: a plugin registers without touching the kernel;
//     matches activates per model;
//   - the OIML plugin: activates on OIML-CS content (and only there —
//     PAS2060-shaped content stays clean), its palettes create valid
//     constructs that serialize and re-parse.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { dump, load, type Standard } from '@primmel/primmel';
import { activePlugins, clearPlugins, registerPlugin, registeredPlugins } from '../index';
import { oimlPlugin } from '../oiml';
import type { StudioPlugin } from '../types';

const OIML_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "Load cells"
  schema "Primmel 0.1"
  namespace "OIML.R60"
}

role r1 { name "R1" }

subject LoadCell {
  is {
    metadata {
      name "Load cell"
    }
    design_parameters {
      accuracy_class "C3"
    }
  }
  has {
    attributes {
      capacity "30 kg"
    }
  }
}

canvas Root {
  elements {
  }
  process_flow {
  }
}`;

const PLAIN_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "PAS 2060 demo"
  schema "Primmel 0.1"
  namespace "PAS2060Application"
}

role entity { name "Entity" }

process QuantifyCarbon {
  name "Quantify carbon footprint"
  actor entity
}

canvas Root {
  elements {
    QuantifyCarbon { x 0 y 0 }
  }
  process_flow {
  }
}`;

beforeEach(() => {
  clearPlugins();
});

describe('17 — the registry', () => {
  it('a third plugin registers without touching the kernel', () => {
    const third: StudioPlugin = {
      id: 'third-program',
      matches: () => true,
      palettes: [],
    };
    registerPlugin(third);
    registerPlugin(third); // idempotent
    expect(registeredPlugins().map(p => p.id)).toEqual(['third-program']);
    expect(activePlugins(load(PLAIN_TEXT)).map(p => p.id)).toEqual(['third-program']);
  });
});

describe('17 — the OIML plugin', () => {
  it('activates on OIML-CS content, stays out of plain models', () => {
    registerPlugin(oimlPlugin);
    expect(activePlugins(load(OIML_TEXT)).map(p => p.id)).toEqual(['oiml-smart']);
    expect(activePlugins(load(PLAIN_TEXT))).toEqual([]);
  });

  it('the palettes create valid constructs (round-trip through the dump)', () => {
    const ast: Standard = load(OIML_TEXT);
    for (const entry of oimlPlugin.palettes ?? []) {
      entry.create(ast).apply(ast);
    }
    expect(ast.requirements).toHaveLength(1);
    expect(ast.conformanceTests).toHaveLength(1);
    expect(ast.forms).toHaveLength(1);
    expect(ast.subjects).toHaveLength(2); // the fixture's + the palette's

    const text = dump(ast);
    const reparsed = load(text, { strict: true });
    expect(reparsed.requirements).toHaveLength(1);
    expect(reparsed.conformanceTests).toHaveLength(1);
    expect(reparsed.forms).toHaveLength(1);
    expect(reparsed.subjects).toHaveLength(2);
  });

  it('the instrument palette mints the MI chain id', () => {
    const ast: Standard = load(PLAIN_TEXT);
    oimlPlugin.palettes![3]!.create(ast).apply(ast);
    expect(ast.subjects.map(s => s.id)).toEqual(['MI1']);
    // …and it reverts exactly.
    const before = load(PLAIN_TEXT);
    ast.subjects = [];
    expect(JSON.parse(JSON.stringify(ast))).toEqual(JSON.parse(JSON.stringify(before)));
  });
});

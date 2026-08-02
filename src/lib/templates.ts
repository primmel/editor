// ─────────────────────────────────────────────────────────────────────
// The new-model templates (TODO.editor/22) — honest PRL text for the
// three starting points. The template is TEXT, parsed by the same
// kernel path as every other model — no special AST seeding.
// ─────────────────────────────────────────────────────────────────────

export type ModelKind = 'blank' | 'reference' | 'implementation';

export const MODEL_KIND_LABELS: Record<ModelKind, { title: string; doctrine: string }> = {
  blank: {
    title: 'Blank model',
    doctrine: 'the minimal working model — a root canvas and one role',
  },
  reference: {
    title: 'Reference model',
    doctrine: 'the standard you comply with — a normative skeleton',
  },
  implementation: {
    title: 'Implementation model',
    doctrine: 'your operations that comply — maps onto reference models',
  },
};

/** The template for a new model. `namespace` becomes the model's
 *  namespace (and its role id); the title is the document title. */
export function newModelTemplate(
  kind: ModelKind,
  opts: { title: string; namespace: string },
): string {
  const ns = opts.namespace.trim() || 'NewModel';
  const title = opts.title.trim() || ns;
  const roleId = ns.replace(/[^A-Za-z0-9_]/g, '') || 'Actor';

  const head = `root Root

version "v1.0.0-dev1"

metadata {
  title "${title.replace(/"/g, '\\"')}"
  schema "Primmel 0.1"
  namespace "${ns.replace(/"/g, '\\"')}"
}

role ${roleId} { name "${title.replace(/"/g, '\\"')}" }

start_event Start { }
end_event Done { }
`;

  if (kind === 'blank') {
    return `${head}
canvas Root {
  elements {
    Start { x 0 y 0 }
    Done { x 0 y 200 }
  }
  process_flow {
  }
}`;
  }

  const process = `process FirstProcess {
  name "${kind === 'reference' ? 'The first normative activity' : 'The first operational activity'}"
  actor ${roleId}
  modality SHALL
}
`;

  const note = kind === 'implementation'
    ? `
note MappingGuide {
  type NOTE
  message "Map this implementation onto reference models in the Mapping view — pairs land in this model's map_profile."
}
`
    : '';

  return `${head}
${process}${note}
canvas Root {
  elements {
    Start { x 0 y 0 }
    FirstProcess { x 0 y 120 }
    Done { x 0 y 240 }
  }
  process_flow {
    E1 { from Start to FirstProcess }
    E2 { from FirstProcess to Done }
  }
}`;
}

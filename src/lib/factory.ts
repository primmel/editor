// ─────────────────────────────────────────────────────────────────────
// The element factory (TODO.editor/03) — the palette's creation
// commands: id minting, default facets per kind, event subtypes, and
// the create command with its undo (delete the minted element and
// everything attached).
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import { createElement, mintId, updateElement, type Command, type ElementKind } from './commands';

export interface PaletteKind {
  kind: ElementKind;
  /** Event subtype when kind === 'event'. */
  eventType?: 'start' | 'end' | 'signalcatch' | 'timer';
  label: string;
  /** The id prefix the mint uses (P1, DC1, Start1…). */
  idPrefix: string;
}

/** The palette — every PRL element kind (the Studio kernel's set;
 *  program palettes extend via the plugin registry, TODO.editor/17). */
export const PALETTE: PaletteKind[] = [
  { kind: 'process', label: 'Process', idPrefix: 'P' },
  { kind: 'approval', label: 'Approval', idPrefix: 'A' },
  { kind: 'dataclass', label: 'Data class', idPrefix: 'DC' },
  { kind: 'event', eventType: 'start', label: 'Start event', idPrefix: 'Start' },
  { kind: 'event', eventType: 'end', label: 'End event', idPrefix: 'Done' },
  { kind: 'event', eventType: 'timer', label: 'Timer event', idPrefix: 'T' },
  { kind: 'event', eventType: 'signalcatch', label: 'Signal event', idPrefix: 'Sig' },
  { kind: 'gateway', label: 'Exclusive gateway', idPrefix: 'X' },
  { kind: 'subprocess', label: 'Subprocess page', idPrefix: 'Page' },
];

/** The create command for a palette drop: the minted id, the defaults,
 *  the event subtype when applicable, the canvas placement. */
export function createFromPalette(
  ast: Standard,
  entry: PaletteKind,
  position?: { x: number; y: number },
  pageId = 'root',
): Command {
  const id = mintId(ast, entry.idPrefix);
  const create = createElement(entry.kind, id, position, pageId);
  const subtype = entry.eventType && entry.eventType !== 'start'
    ? updateElement((a: Standard) => a.events as Array<{ id: string; eventType: string }>, id, { eventType: entry.eventType })
    : null;
  return {
    label: `create ${entry.label.toLowerCase()} ${id}`,
    apply(ast) {
      create.apply(ast);
      subtype?.apply(ast);
    },
    revert(ast) {
      subtype?.revert(ast);
      create.revert(ast);
    },
  };
}

/** The id a palette create will mint (the palette shows it as a hint). */
export function previewId(ast: Standard, entry: PaletteKind): string {
  return mintId(ast, entry.idPrefix);
}

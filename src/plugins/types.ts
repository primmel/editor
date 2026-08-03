// ─────────────────────────────────────────────────────────────────────
// The Studio plugin contract (TODO.editor/17) — program layers plug
// conveniences into the Studio through the registry, never through a
// program-id branch in the kernel. Primmel Studio is the base layer;
// 〈scope〉 SMART programs (OIML SMART first) plug on top.
// ─────────────────────────────────────────────────────────────────────

import type { Component } from 'vue';
import type { Standard } from '@primmel/primmel';
import type { Command } from '../lib/commands';

/** A palette entry a plugin contributes (the Studio's palette panel
 *  appends them, under the program's own section). */
export interface PluginPaletteEntry {
  /** The button label. */
  label: string;
  /** A short text glyph (the palette's icon slot). */
  glyph: string;
  /** The create: mint + land the construct, one command. */
  create: (ast: Standard) => Command;
}

/** A topbar action a plugin contributes. */
export interface PluginAction {
  label: string;
  testid: string;
  /** The action's effect (the store handles commands; anything else
   *  the plugin does in its own components). */
  run: (ctx: { model: Standard; execute: (c: Command) => void }) => void;
}

/** A panel a plugin contributes (rendered as a modal when active). */
export interface PluginPanel {
  id: string;
  label: string;
  component: Component;
}

/** An inspector a plugin contributes: when the selection's type
 *  matches `type`, the ElementInspector renders `component` (props:
 *  `model`, `elementId`) instead of the kernel fallback. */
export interface PluginInspector {
  type: string;
  component: Component;
}

export interface StudioPlugin {
  id: string;
  /** Activation: the plugin applies to this model (e.g. the OIML
   *  plugin matches models carrying OIML-CS constructs). */
  matches: (model: Standard) => boolean;
  palettes?: PluginPaletteEntry[];
  actions?: PluginAction[];
  panels?: PluginPanel[];
  inspectors?: PluginInspector[];
}

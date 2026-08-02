// ─────────────────────────────────────────────────────────────────────
// The plugin registry (TODO.editor/17) — the Studio kernel's seam:
// plugins register at boot; the palette/topbar/panel slots consume
// `activePlugins(model)` — the kernel never names a program.
// ─────────────────────────────────────────────────────────────────────

import type { Standard } from '@primmel/primmel';
import type { StudioPlugin } from './types';

const registry: StudioPlugin[] = [];

/** Register a program plugin (boot-time). */
export function registerPlugin(plugin: StudioPlugin): void {
  if (registry.some(p => p.id === plugin.id)) return;
  registry.push(plugin);
}

/** Every registered plugin (boot order). */
export function registeredPlugins(): StudioPlugin[] {
  return [...registry];
}

/** The plugins active for a model (their `matches` verdict). */
export function activePlugins(model: Standard | null): StudioPlugin[] {
  if (!model) return [];
  return registry.filter(p => {
    try {
      return p.matches(model);
    } catch {
      return false;
    }
  });
}

/** Test seam: clear the registry. */
export function clearPlugins(): void {
  registry.length = 0;
}

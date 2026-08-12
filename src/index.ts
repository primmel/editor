import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import App from './App.vue';
import './styles/theme.css';
import { registerPlugin } from './plugins';
import { oimlPlugin } from './plugins/oiml';
import type { StudioPlugin } from './plugins/types';
import { useModelStore } from './stores/model';

export interface BrandOptions {
  /** Primary wordmark (e.g. "OIML SMART"). Defaults to "Primmel". */
  name: string;
  /** Secondary label under the wordmark (e.g. "STUDIO"). Defaults to "Atelier". */
  sub?: string;
  /** Optional logo URL. When omitted, the default geometric mark is used. */
  logoUrl?: string;
}

export interface MountOptions {
  plugins?: StudioPlugin[];
  initialText?: string;
  /**
   * Program-specific branding. The editor stays program-agnostic by default
   * ("Primmel Atelier"); consumers override at mount time. The brand is
   * surfaced via `provide('brand')` and read by App.vue.
   */
  brand?: BrandOptions;
  ready?: (app: VueApp) => void;
}

export function mount(el: string | Element, opts: MountOptions = {}): VueApp {
  for (const p of opts.plugins ?? [oimlPlugin]) registerPlugin(p);
  const pinia = createPinia();
  const app = createApp(App).use(pinia);
  if (opts.brand) app.provide('brand', opts.brand);
  opts.ready?.(app);
  app.mount(el);
  if (opts.initialText !== undefined) {
    useModelStore(pinia).loadText(opts.initialText);
  }
  return app;
}

export { App, registerPlugin };


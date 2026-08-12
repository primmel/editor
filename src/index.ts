import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import App from './App.vue';
import './styles/theme.css';
import { registerPlugin } from './plugins';
import { oimlPlugin } from './plugins/oiml';
import type { StudioPlugin } from './plugins/types';
import { useModelStore } from './stores/model';

export interface MountOptions {
  plugins?: StudioPlugin[];
  initialText?: string;
  ready?: (app: VueApp) => void;
}

export function mount(el: string | Element, opts: MountOptions = {}): VueApp {
  for (const p of opts.plugins ?? [oimlPlugin]) registerPlugin(p);
  const pinia = createPinia();
  const app = createApp(App).use(pinia);
  opts.ready?.(app);
  app.mount(el);
  if (opts.initialText !== undefined) {
    useModelStore(pinia).loadText(opts.initialText);
  }
  return app;
}

export { App, registerPlugin };

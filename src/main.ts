import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/theme.css';
import { registerPlugin } from './plugins';
import { oimlPlugin } from './plugins/oiml';

// The program layers register at boot (TODO.editor/17) — Primmel
// Studio is the base; OIML SMART plugs its conveniences on top.
registerPlugin(oimlPlugin);

createApp(App).use(createPinia()).mount('#app');

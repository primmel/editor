import { mount } from './index';

// The dev harness mounts the full editor; `?readonly` previews the
// viewer mode (the e2e viewer leg drives the same flag).
const readOnly = new URLSearchParams(window.location.search).has('readonly');
mount('#app', { readOnly });

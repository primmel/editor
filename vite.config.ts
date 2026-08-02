import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────
// The save API (TODO.editor/18) — the dev server's write path: POST
// /api/save { path, text } writes the file with a .bak backup,
// constrained to .prl/.mmel under the project root. GET answers a
// small status document (the panel's availability probe).
// ─────────────────────────────────────────────────────────────────────
function saveApi(): Plugin {
  return {
    name: 'primmel-save-api',
    configureServer(server) {
      server.middlewares.use('/api/save', (req, res) => {
        res.setHeader('content-type', 'application/json');
        if (req.method === 'GET') {
          res.end(JSON.stringify({ available: true }));
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { path: relPath, text } = JSON.parse(body) as { path: string; text: string };
            const root = process.cwd();
            const full = path.resolve(root, relPath);
            if (!full.startsWith(root + path.sep)) throw new Error('path escapes the project root');
            if (!/\.(prl|mmel)$/.test(full)) throw new Error('only .prl/.mmel writes are accepted');
            fs.mkdirSync(path.dirname(full), { recursive: true });
            const backup = fs.existsSync(full);
            if (backup) fs.copyFileSync(full, full + '.bak');
            fs.writeFileSync(full, text);
            res.end(JSON.stringify({ ok: true, backup }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), saveApi()],
  base: './',
});

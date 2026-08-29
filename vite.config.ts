import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { guardSavePath } from './scripts/save-api-guard';
import { guardPackageDir, guardPackageFile } from './scripts/package-api-guard';
import { openPackagePayload } from './scripts/package-open';

// ─────────────────────────────────────────────────────────────────────
// The save API (TODO.editor/18) — the dev server's write path: POST
// /api/save { path, text } writes the file with a .bak backup,
// constrained by scripts/save-api-guard.mjs (unit-tested). GET
// answers a small status document (the panel's availability probe).
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
            const full = guardSavePath(process.cwd(), relPath);
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

// ─────────────────────────────────────────────────────────────────────
// The package API (TODO.editor wave 1) — the package is the unit of
// work. The kernel's provenance load is fs-based (node only), so the
// dev server runs it and ships the merged dump + the provenance map +
// the root package's authored file texts to the browser:
//
//   GET  /api/package         availability probe (like /api/save)
//   POST /api/package/open    { dir } → the package session payload
//   POST /api/package/save    { dir, writes: [{ path, text }] } → the
//                             per-file write (.bak kept), guarded to
//                             stay inside the opened package
//
// `uses` composition resolves a dependency by package id against the
// opened directory's SIBLINGS first, then the roots listed in
// PRIMMEL_PACKAGE_ROOTS (path-delimited).
// ─────────────────────────────────────────────────────────────────────

interface PackageWrite {
  path: string;
  text: string;
}

function packageApi(): Plugin {
  return {
    name: 'primmel-package-api',
    configureServer(server) {
      const readBody = (req: NodeJS.ReadableStream): Promise<string> =>
        new Promise((resolve) => {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => resolve(body));
        });

      server.middlewares.use('/api/package', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        const sub = (req.url ?? '/').split('?')[0];
        if (req.method === 'GET' && (sub === '/' || sub === '')) {
          res.end(JSON.stringify({ available: true }));
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        try {
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          if (sub === '/open') {
            res.end(JSON.stringify(openPackagePayload(String(body.dir ?? ''))));
            return;
          }
          if (sub === '/save') {
            const dir = guardPackageDir(String(body.dir ?? ''));
            const writes = body.writes as PackageWrite[];
            if (!Array.isArray(writes) || writes.length === 0) {
              throw new Error('writes must be a non-empty array of { path, text }');
            }
            const files = [];
            for (const w of writes) {
              const full = guardPackageFile(dir, w.path);
              fs.mkdirSync(path.dirname(full), { recursive: true });
              const backup = fs.existsSync(full);
              if (backup) fs.copyFileSync(full, full + '.bak');
              fs.writeFileSync(full, w.text);
              files.push({ path: w.path, backup });
            }
            res.end(JSON.stringify({ ok: true, files }));
            return;
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `unknown package op: ${sub}` }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), saveApi(), packageApi()],
  base: './',
});

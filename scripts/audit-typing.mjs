#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// The typing-discipline gate (TODO.editor/33) — grep-class audits,
// dependency-free, wired into the build. Each rule fails with the
// file and the law it breaks:
//
//   R1  no `as never` / `as unknown` outside the documented seams
//   R2  no `: any` / `as any` in shipped src
//   R3  no duck-typing dispatch outside the value-domain evaluator
//   R4  no deep imports (kernel internals, dist paths, node_modules)
//   R5  no require()/require_relative-style loads in src
//   R6  one definition per seam (edgeEnds is the canary)
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;

/** The documented seams (each MUST carry its justification comment). */
const SEAM_ALLOW = [
  { file: 'App.vue', pattern: 'window as unknown as { __stores: unknown }', why: 'the dev-only window hook' },
  { file: 'components/CodeEditor.vue', pattern: 'window as unknown as { __editor: unknown }', why: 'the dev-only monaco hook' },
  { file: 'lib/edges.ts', pattern: 'as unknown as { _relations?:', why: 'the raw parse-shape lens' },
];

const failures = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* walk(full);
    } else if (/\.(ts|vue)$/.test(entry)) {
      yield full;
    }
  }
}

for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;

    // R1 — as never / as unknown outside the seams.
    if (/\bas never\b|\bas unknown\b/.test(line)) {
      const allowed = SEAM_ALLOW.some(s =>
        rel === s.file && line.includes(s.pattern.split(' as ')[1] ?? '') || (rel === s.file && text.includes(s.why)));
      if (!allowed) {
        failures.push(`R1 ${rel}:${n} — ${line.trim()} (law: the fix is the type export upstream, never a cast)`);
      }
    }

    // R2 — lazy any in shipped src.
    if (/: any\b|as any\b/.test(line) && !/eslint/.test(line)) {
      failures.push(`R2 ${rel}:${n} — ${line.trim()} (law: declare the honest type; a boundary gets a declared interface)`);
    }

    // R3 — duck-typing dispatch (typeof-as-dispatch outside the value domain).
    if (/typeof [a-zA-Z_$.]+ === '(function|string|object|undefined)'/.test(line)) {
      failures.push(`R3 ${rel}:${n} — ${line.trim()} (law: discriminated unions, not respond_to)`);
    }

    // R4 — deep imports.
    if (/from '[^']*(node_modules|\/dist\/|\.yarn)/.test(line)) {
      failures.push(`R4 ${rel}:${n} — ${line.trim()} (law: module boundaries only — the public API)`);
    }

    // R5 — require-style loads in src.
    if (/^\s*(const|let|var) .*= require\(|^\s*import .*= require\(/.test(line)) {
      failures.push(`R5 ${rel}:${n} — ${line.trim()} (law: ESM imports only)`);
    }
  });
}

// R6 — the seam singletons (canary: edgeEnds has exactly one definition).
{
  let edgeEndsDefs = 0;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    edgeEndsDefs += (text.match(/function edgeEnds/g) ?? []).length;
  }
  if (edgeEndsDefs !== 1) {
    failures.push(`R6 — edgeEnds defined ${edgeEndsDefs} times (law: one home per seam)`);
  }
}

if (failures.length > 0) {
  console.error('typing-discipline gate FAILED:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('typing-discipline gate: clean (R1–R6)');

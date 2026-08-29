import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance, dump, load } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The package leg (TODO.editor wave 1) — open a v3 PACKAGE directory
// as the unit of work, edit, save per file, prove the bytes on disk.
// The fixture tree is copied to a temp dir first: the write path is
// real, the committed fixtures stay pristine.
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-pkg-e2e-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
for (const pkg of ['pkg-lib', 'pkg-app']) {
  fs.cpSync(path.join(FIXTURES, pkg), path.join(root, pkg), { recursive: true })
}
const PKG_DIR = path.join(root, 'pkg-app')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('PACKAGE FAILED:', why); await browser.close(); process.exit(1) }

// 1. The Open pkg chrome is up (the dev server's package API answers).
await page.waitForSelector('[data-testid="open-package"]', { timeout: 5000 }).catch(() => null)
let probe = await page.evaluate(`(() => ({
  btn: !!document.querySelector('[data-testid="open-package"]'),
}))()`)
if (!probe.btn) await fail('the Open pkg button never appeared (package API down?)')

// 2. Open the temp-copy package through the dialog.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-package"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="package-dir"]')
  input.value = ${JSON.stringify(PKG_DIR)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="package-open-confirm"]').click() })()`)
await page.waitForSelector('[data-testid="package-opened"]', { timeout: 8000 }).catch(() => null)
probe = await page.evaluate(`(() => ({
  opened: !!document.querySelector('[data-testid="package-opened"]'),
  clean: !!document.querySelector('[data-testid="package-clean"]'),
  error: document.querySelector('[data-testid="package-error"]')?.textContent ?? null,
}))()`)
console.log('open:', JSON.stringify(probe))
if (!probe.opened) await fail(`the package did not open: ${probe.error}`)
if (!probe.clean) await fail('the fixture should load without advisories')
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

// 3. The workspace reflects the package: the pill, the file map, the
//    import footprint, the merged model (1 process, 1 requirement,
//    2 imported terms).
probe = await page.evaluate(`(() => ({
  pill: document.querySelector('[data-testid="package-pill"]')?.textContent?.trim() ?? null,
  files: !!document.querySelector('[data-testid="package-files"]'),
  processFile: !!document.querySelector('[data-testid="package-file-model/processes.prl"]'),
  importLib: !!document.querySelector('[data-testid="package-import-pkg-lib"]'),
  model: (() => { const s = window.__stores.model; return {
    pkg: s.pkg?.id ?? null,
    processes: s.standard.processes.length,
    requirements: s.standard.requirements.length,
    terms: s.standard.terms.length,
    manifest: s.standard.packageManifest?.id ?? null,
  } })(),
}))()`)
console.log('workspace:', JSON.stringify(probe))
if (!probe.pill?.includes('pkg-app') || !probe.files || !probe.processFile || !probe.importLib)
  await fail('the package chrome did not render')
if (probe.model.pkg !== 'pkg-app' || probe.model.processes !== 1 || probe.model.requirements !== 1
  || probe.model.terms !== 2 || probe.model.manifest !== 'pkg-app')
  await fail('the composed model is wrong')

// 4. An edit dirties the package; the save panel plans per file.
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'probe rename',
    apply(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble widgets v2' },
    revert(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble widgets' },
  })
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
probe = await page.evaluate(`(() => ({
  plan: !!document.querySelector('[data-testid="pkg-save-plan"]'),
  row: document.querySelector('[data-testid="pkg-save-row-model/processes.prl"]')?.textContent?.trim() ?? null,
  onlyRow: document.querySelectorAll('[data-testid^="pkg-save-row-"]').length,
  foreign: document.querySelectorAll('[data-testid="pkg-save-foreign"]').length,
}))()`)
console.log('plan:', JSON.stringify(probe))
if (!probe.plan || !probe.row?.includes('model/processes.prl') || probe.onlyRow !== 1)
  await fail('the plan should write exactly model/processes.prl')
if (probe.foreign !== 0) await fail('no foreign edits were made — none should be flagged')

// 5. Write. The bytes on disk: the touched file carries the edit; the
//    untouched files keep their authored bytes (the comment survives).
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  done: document.querySelector('[data-testid="save-done"]')?.textContent ?? null,
  dirtyGone: !document.querySelector('[data-testid="dirty-dot"]'),
}))()`)
console.log('written:', JSON.stringify(probe))
if (!probe.done?.includes('written to the package') || !probe.dirtyGone) await fail('the write did not complete')

const processesText = fs.readFileSync(path.join(PKG_DIR, 'model/processes.prl'), 'utf8')
const requirementsText = fs.readFileSync(path.join(PKG_DIR, 'requirements.prl'), 'utf8')
const libText = fs.readFileSync(path.join(root, 'pkg-lib/terminology.prl'), 'utf8')
if (!processesText.includes('Assemble widgets v2')) await fail('the edit is not on disk')
if (requirementsText !== fs.readFileSync(path.join(FIXTURES, 'pkg-app/requirements.prl'), 'utf8'))
  await fail('an untouched file changed bytes')
if (!libText.includes('a comment the save must never strip')) await fail('the import was written')
if (!fs.existsSync(path.join(PKG_DIR, 'model/processes.prl.bak'))) await fail('the .bak backup is missing')

// 6. The written package reloads to the working model exactly (the
//    kernel's provenance load over the new bytes ≡ the editor's AST).
const reloaded = loadPackageWithProvenance(PKG_DIR, {
  resolvePackage: (id) => {
    const p = path.join(root, id)
    return fs.existsSync(path.join(p, 'package.primmel')) ? p : undefined
  },
})
const workingText = await page.evaluate(`window.__stores.model.serialize()`)
if (dump(reloaded.standard) !== dump(load(workingText, { strict: true })))
  await fail('the reloaded package differs from the editor model')

console.log('PACKAGE OK')
await browser.close()
process.exit(0)

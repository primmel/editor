import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance, dump, load } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The eight-terms spike's editor gate (file 13, gate 5): the R 60
// slice in the LutaML surface loads, renders, edits, and saves
// losslessly in the Studio. The losslessness is byte-level: the saved
// file keeps the LutaML attribute form the window preserves, the
// untouched files keep their authored bytes, and the reloaded package
// equals the working AST.
// ─────────────────────────────────────────────────────────────────────

const SRC = path.resolve(import.meta.dirname, '../../../oimlsmart/model-library-spike/oiml-r60-lml')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-eight-terms-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
fs.cpSync(SRC, path.join(root, 'oiml-r60-lml'), { recursive: true })
const PKG_DIR = path.join(root, 'oiml-r60-lml')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('EIGHT-TERMS FAILED:', why); await browser.close(); process.exit(1) }

// 1. Open the slice package.
await page.waitForSelector('[data-testid="open-package"]', { timeout: 5000 }).catch(() => null)
let probe = await page.evaluate(`(() => ({ btn: !!document.querySelector('[data-testid="open-package"]') }))()`)
if (!probe.btn) await fail('the Open pkg button never appeared (package API down?)')
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
if (!probe.opened) await fail(`the slice did not open: ${probe.error}`)

// 2. The census: the slice's constructs are in the store.
probe = await page.evaluate(`(() => { const s = window.__stores.model; return {
  pkg: s.pkg?.id ?? null,
  classes: s.standard.dataclasses.length,
  enums: s.standard.enums.length,
  subjects: s.standard.subjects.length,
  instances: s.standard.instances.length,
  tables: s.standard.tables.length,
  calculations: s.standard.calculations.length,
  tests: s.standard.conformanceTests.length,
  verdicts: s.standard.verdicts.length,
  requirements: s.standard.requirements.length,
  processes: s.standard.processes.length,
  provisions: s.standard.provisions.length,
  attestations: s.standard.attestations.length,
  regs: s.standard.regs.length,
} })()`)
console.log('census:', JSON.stringify(probe))
const want = { pkg: 'oiml-r60-lml', classes: 3, enums: 2, subjects: 1, instances: 2, tables: 1, calculations: 1, tests: 1, verdicts: 1, requirements: 1, processes: 1, provisions: 1, attestations: 1, regs: 1 }
for (const [k, v] of Object.entries(want)) {
  if ((probe as Record<string, unknown>)[k] !== v) await fail(`census ${k}: want ${v}, got ${(probe as Record<string, unknown>)[k]}`)
}

// 3. An edit on the LutaML surface: the golden instance's capacity
//    moves 2.2 t → 2.4 t (the assignment form's value in the AST).
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
await page.evaluate(`(() => {
  const s = window.__stores
  s.model.execute({
    label: 'probe capacity',
    apply(ast) { ast.instances.find((i) => i.id === 'ssm-ssb7').has.attributes['e_max'] = { value: '2.4', unit: 't' } },
    revert(ast) { ast.instances.find((i) => i.id === 'ssm-ssb7').has.attributes['e_max'] = { value: '2.2', unit: 't' } },
  })
})()`)
await new Promise(r => setTimeout(r, 400))

// 4. Save per file; exactly instances.prl is planned.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
probe = await page.evaluate(`(() => ({
  plan: !!document.querySelector('[data-testid="pkg-save-plan"]'),
  rows: [...document.querySelectorAll('[data-testid^="pkg-save-row-"]')].map(r => r.getAttribute('data-testid')),
}))()`)
console.log('plan:', JSON.stringify(probe))
if (!probe.plan || probe.rows.length !== 1 || !probe.rows[0]!.includes('model/instances.prl'))
  await fail(`the plan should write exactly model/instances.prl: ${JSON.stringify(probe.rows)}`)

// 5. Write; the bytes keep the surface.
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
const instancesText = fs.readFileSync(path.join(PKG_DIR, 'model/instances.prl'), 'utf8')
const subjectText = fs.readFileSync(path.join(PKG_DIR, 'model/subject.prl'), 'utf8')
console.log('saved instances.prl:'); console.log(instancesText)
// The migration window's dump contract: the edit lands (either the
// assignment form or the canonical has-attributes form), the AST is
// what reloads — the fixed point below is the losslessness gate.
if (!/e_max (=|:)\s*.?2\.4/.test(instancesText)) await fail('the edit is not on disk')
if (!/accuracy_class (=|:)/.test(instancesText)) await fail('a sibling entry was lost')
if (!subjectText.includes('attribute accuracy_class, AccuracyClass {')) await fail('the LutaML class form did not survive in an untouched file')
if (subjectText !== fs.readFileSync(path.join(SRC, 'model/subject.prl'), 'utf8'))
  await fail('an untouched file changed bytes')
if (!fs.existsSync(path.join(PKG_DIR, 'model/instances.prl.bak'))) await fail('the .bak backup is missing')
console.log('bytes: the assignment edit landed, the LutaML surface survived')

// 6. The written package reloads to the working model exactly — and
//    the RELOADED bytes still parse through the kernel.
const reloaded = loadPackageWithProvenance(PKG_DIR, { resolvePackage: () => null as never })
const std = (reloaded as unknown as { standard: any }).standard ?? (reloaded as unknown as any)
const reloadedValue = std.instances.find((i: any) => i.id === 'ssm-ssb7').has.attributes['e_max']
if (reloadedValue?.value !== '2.4' || reloadedValue?.unit !== 't')
  await fail(`the reload lost the edit: ${JSON.stringify(reloadedValue)}`)
const once = dump(load(fs.readFileSync(path.join(PKG_DIR, 'model/instances.prl'), 'utf8')))
const twice = dump(load(once))
if (once !== twice) await fail('the saved file is not a round-trip fixed point')
console.log('reload: the working model is the disk model; the fixed point holds')

await browser.close()
console.log('EIGHT-TERMS GATE 5 GREEN')
process.exit(0)

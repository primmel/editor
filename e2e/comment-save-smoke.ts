import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance, dump, load } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The comment-true save leg (TODO.editor wave 2) — open the heavily
// commented pkg-commented fixture (temp-copied: the write path is real,
// the committed fixture stays pristine), edit one construct, write, and
// prove the byte discipline on disk: the written file is the authored
// file with ONLY the construct's span replaced — every banner, every
// comment line, every authored blank line outside the span is verbatim.
// Then a SECOND edit+save cycle in the same session proves the
// provenance re-base (the new bytes' spans, never stale offsets).
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-comment-e2e-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
fs.cpSync(path.join(FIXTURES, 'pkg-commented'), path.join(root, 'pkg-commented'), { recursive: true })
const PKG_DIR = path.join(root, 'pkg-commented')

// The authored bytes + the construct span BEFORE any write (the splice
// equation's left-hand side).
const authoredMain = fs.readFileSync(path.join(PKG_DIR, 'model/main.prl'), 'utf8')
const authoredReqs = fs.readFileSync(path.join(PKG_DIR, 'requirements.prl'), 'utf8')
const prov0 = loadPackageWithProvenance(PKG_DIR).provenance.constructs['processes']?.['assemble']
if (!prov0) { console.log('COMMENT-SAVE FAILED: no provenance for processes/assemble'); process.exit(1) }
const span0 = prov0.span
const commentLines = (t: string) => t.split('\n').filter((l) => l.trim().startsWith('//'))

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('COMMENT-SAVE FAILED:', why); await browser.close(); process.exit(1) }

// 1. Open the temp-copy package through the dialog.
await page.waitForSelector('[data-testid="open-package"]', { timeout: 5000 }).catch(() => null)
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
let probe = await page.evaluate(`(() => ({
  opened: !!document.querySelector('[data-testid="package-opened"]'),
  processes: window.__stores.model.standard.processes.length,
}))()`)
console.log('open:', JSON.stringify(probe))
if (!probe.opened || probe.processes !== 1) await fail('the package did not open')
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

// 2. Edit one construct (the process name) and write through the panel.
await page.evaluate(`(() => {
  window.__stores.model.execute({
    label: 'probe rename',
    apply(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble gadgets v2' },
    revert(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble gadgets' },
  })
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
probe = await page.evaluate(`(() => ({
  rows: [...document.querySelectorAll('[data-testid^="pkg-save-row-"]')].map((r) => r.textContent.trim()),
}))()`)
console.log('plan:', JSON.stringify(probe))
if (probe.rows.length !== 1 || !probe.rows[0].includes('model/main.prl'))
  await fail('the plan should write exactly model/main.prl')
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  done: document.querySelector('[data-testid="save-done"]')?.textContent ?? null,
}))()`)
if (!probe.done?.includes('written to the package')) await fail('the first write did not complete')

// 3. The byte discipline on disk: the splice equation holds EXACTLY.
const written1 = fs.readFileSync(path.join(PKG_DIR, 'model/main.prl'), 'utf8')
const replacement1 = `process assemble {
  name "Assemble gadgets v2"
}`
const expected1 = authoredMain.slice(0, span0.start.offset) + replacement1 + authoredMain.slice(span0.end.offset)
if (written1 !== expected1) await fail('the written file is not the authored file with only the construct span spliced')
for (const line of commentLines(authoredMain)) {
  if (!written1.includes(line)) await fail(`a comment line did not survive: ${line}`)
}
if (fs.readFileSync(path.join(PKG_DIR, 'requirements.prl'), 'utf8') !== authoredReqs)
  await fail('the untouched requirements file changed bytes')
if (!fs.existsSync(path.join(PKG_DIR, 'model/main.prl.bak'))) await fail('the .bak backup is missing')
console.log('splice equation: OK (' + commentLines(authoredMain).length + ' comment lines verbatim)')

// 4. The written package reloads to the editor's model exactly.
const reloaded1 = loadPackageWithProvenance(PKG_DIR)
const workingText1 = await page.evaluate(`window.__stores.model.serialize()`)
if (dump(reloaded1.standard) !== dump(load(workingText1, { strict: true })))
  await fail('the reloaded package differs from the editor model')

// 5. The second edit+save cycle: the provenance re-base must splice the
//    NEW bytes (never stale offsets). The session's span for the
//    construct now points into the first write's text.
await page.evaluate(`(() => { document.querySelector('[data-testid="save-close"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
const span1 = await page.evaluate(`(() => {
  const src = window.__stores.model.pkg.provenance.constructs.processes.assemble
  return { start: src.span.start.offset, end: src.span.end.offset }
})()`)
if (written1.slice(span1.start, span1.end) !== replacement1)
  await fail('the re-based span does not point at the written construct')

await page.evaluate(`(() => {
  window.__stores.model.execute({
    label: 'probe rename 2',
    apply(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble gadgets v3' },
    revert(ast) { ast.processes.find((p) => p.id === 'assemble').name = 'Assemble gadgets v2' },
  })
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  done: document.querySelector('[data-testid="save-done"]')?.textContent ?? null,
}))()`)
if (!probe.done?.includes('written to the package')) await fail('the second write did not complete')

const written2 = fs.readFileSync(path.join(PKG_DIR, 'model/main.prl'), 'utf8')
const replacement2 = `process assemble {
  name "Assemble gadgets v3"
}`
const expected2 = written1.slice(0, span1.start) + replacement2 + written1.slice(span1.end)
if (written2 !== expected2) await fail('the second write did not splice the re-based span')
const reloaded2 = loadPackageWithProvenance(PKG_DIR)
const workingText2 = await page.evaluate(`window.__stores.model.serialize()`)
if (dump(reloaded2.standard) !== dump(load(workingText2, { strict: true })))
  await fail('the twice-written package differs from the editor model')
console.log('second splice (re-based spans): OK')

console.log('COMMENT-SAVE OK')
await browser.close()
process.exit(0)

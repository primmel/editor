import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────
// The check leg (TODO.editor/05, slice 4) — the Check tab states the
// wall before any package is open, then runs `primmel check` against
// the opened package as saved on disk and renders the kernel's issue
// list joined to the rule catalog (family groups, the fixture's C5).
// The fixture tree is copied to a temp dir: the committed fixtures stay
// pristine, mirroring the package leg.
// ─────────────────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../src/lib/__tests__/fixtures')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-check-e2e-'))
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

const fail = async (why: string) => { console.log('CHECK FAILED:', why); await browser.close(); process.exit(1) }

// 1. Before any package is open, the Check tab states the wall — no run
//    button, no fake live-model check.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-check"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let probe = await page.evaluate(`(() => ({
  wall: !!document.querySelector('[data-testid="check-wall"]'),
  run: !!document.querySelector('[data-testid="check-run"]'),
}))()`)
console.log('wall:', JSON.stringify(probe))
if (!probe.wall || probe.run) await fail('the no-package wall did not render')

// 2. Open the temp-copy package through the dialog (the package API idiom).
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
  error: document.querySelector('[data-testid="package-error"]')?.textContent ?? null,
}))()`)
console.log('open:', JSON.stringify(probe))
if (!probe.opened) await fail(`the package did not open: ${probe.error}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 600))

// 3. The tab auto-ran on the package's arrival: the summary chips and
//    the family groups render, with the fixture's one finding (C5) in
//    the base family, and the scope naming the package.
await page.waitForSelector('[data-testid="check-summary"]', { timeout: 8000 }).catch(() => null)
probe = await page.evaluate(`(() => ({
  summary: !!document.querySelector('[data-testid="check-summary"]'),
  warnings: document.querySelector('[data-testid="check-warnings"]')?.textContent?.trim() ?? null,
  issues: document.querySelectorAll('[data-testid^="check-issue-"]').length,
  baseFamily: !!document.querySelector('[data-testid="check-family-base"]'),
  c5: [...document.querySelectorAll('[data-testid^="check-issue-"]')].some((el) => el.textContent.includes('C5')),
  scope: document.querySelector('[data-testid="check-scope"]')?.textContent ?? null,
}))()`)
console.log('run:', JSON.stringify(probe))
if (!probe.summary) await fail('the check summary never rendered')
if (probe.issues < 1 || !probe.baseFamily || !probe.c5) await fail('the fixture C5 warning did not render')
if (!probe.scope?.includes('pkg-app')) await fail('the scope does not name the package')

// 4. A manual re-run reproduces the list (idempotent, no error row).
await page.evaluate(`(() => { document.querySelector('[data-testid="check-run"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  issues: document.querySelectorAll('[data-testid^="check-issue-"]').length,
  error: document.querySelector('[data-testid="check-error"]')?.textContent ?? null,
}))()`)
console.log('rerun:', JSON.stringify(probe))
if (probe.error || probe.issues < 1) await fail(`the re-run broke: ${probe.error}`)

console.log('CHECK OK')
await browser.close()
process.exit(0)

// The instance-store smoke (G13 step 2): a package opens, the
// registry's schema form renders from the paired dataclass, a row is
// added and filled, the save commits (the log shows it), and the row
// persists to the package's workspace file.
import puppeteer from 'puppeteer'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PKG = join(tmpdir(), 'primmel-ws-smoke')
rmSync(PKG, { force: true, recursive: true })
mkdirSync(PKG, { recursive: true })
writeFileSync(join(PKG, 'package.primmel'), 'package {\n  id ws-smoke\n}\n')
writeFileSync(
  join(PKG, 'model.prl'),
  `root Root

version "v1.0.0-dev1"

metadata {
  title "WS"
  schema "Primmel 0.1"
  namespace "ws"
}

class Sample#data {
  store { samples }
  id: string [1..1] { modality SHALL }
  note: string [0..1] { modality MAY }
}

data_registry samples {
  title "Samples"
  data_class Sample#data
}
`,
)
execSync('git init -q .', { cwd: PKG })
execSync('git -c user.name=smoke -c user.email=smoke@primmel.local add -A', { cwd: PKG })
execSync('git -c user.name=smoke -c user.email=smoke@primmel.local commit -qm "the package, before any data"', { cwd: PKG })

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1400, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = async (why: string) => { console.log('WORKSPACE-DATA FAILED:', why); await browser.close(); process.exit(1) }

// 1. The package opens through the same API the panel uses.
await page.evaluate(`(async () => {
  const res = await fetch('/api/package/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir: ${JSON.stringify(PKG)} }),
  })
  const payload = await res.json()
  window.__stores.model.openPackage(payload)
})()`)
await sleep(700)

// 2. The workspace tab: the registry section with the schema form.
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-workspace"]').click() })()`)
await sleep(400)
const head = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="workspace-data"]'),
  schema: document.querySelector('[data-testid="workspace-data"] .wsdata-schema')?.textContent?.trim() ?? null,
}))()`)
console.log('panel:', JSON.stringify(head))
if (!head.panel || !head.schema?.includes('Sample#data')) await fail('no schema form')

// 3. Add a row, fill the fields, save — the commit.
await page.evaluate(`(() => { document.querySelector('[data-testid="wsdata-add"]').click() })()`)
await sleep(200)
await page.evaluate(`(() => {
  const id = document.querySelector('[data-testid^="wsdata-field-samples-row-1-id"]')
  const note = document.querySelector('[data-testid^="wsdata-field-samples-row-1-note"]')
  id.value = '6181Y-1'; id.dispatchEvent(new Event('input'))
  note.value = 'first specimen'; note.dispatchEvent(new Event('input'))
})()`)
await sleep(200)
await page.evaluate(`(() => { document.querySelector('[data-testid="wsdata-save"]').click() })()`)
await sleep(1200)

const after = await page.evaluate(`(() => ({
  commit: document.querySelector('[data-testid="wsdata-commit"]')?.textContent ?? null,
  history: [...document.querySelectorAll('[data-testid^="wsdata-hist-"]')].map((h) => h.textContent?.trim()),
}))()`)
console.log('saved:', JSON.stringify(after))
if (!after.commit?.includes('committed')) await fail('no commit note')
if (!after.history.some((h) => h?.includes('workspace: samples'))) await fail('no history row')

// 4. The row persisted to the package's workspace file.
const readback = await page.evaluate(`(async () => {
  const res = await fetch('/api/package/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir: ${JSON.stringify(PKG)}, path: 'workspace/instances.json' }),
  })
  return await res.json()
})()`)
console.log('file:', JSON.stringify(readback).slice(0, 220))
if (!JSON.stringify(readback).includes('6181Y-1')) await fail('row not persisted')
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('WORKSPACE-DATA OK')
await browser.close()

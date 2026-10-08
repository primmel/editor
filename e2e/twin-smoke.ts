// The twin smoke (G14): the BS6004 showcase imports (the legacy path),
// the Twin tab opens, the stream starts, the TABLE lookups derive, the
// clock advances — the digital-twin golden path in a real browser.
import puppeteer from 'puppeteer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1400, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function click(sel: string) {
  await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) throw new Error('no element ${sel}')
    el.click()
  })()`)
}

// 1. Import the showcase BS6004 through the legacy importer (the demo
// path: .mmel text → translated canonical → the working model).
const mmel = readFileSync(join(homedir(), 'src/mn/mmel-models/showcase 5/BS6004.mmel'), 'utf8')
await page.evaluate(`(async () => {
  const { importLegacy } = await import('/src/lib/mmel-import.ts')
  const result = importLegacy(${JSON.stringify(mmel)})
  window.__stores.model.loadText(result.canonical)
})()`)
await sleep(1200)

const imported = await page.evaluate(`(() => ({
  variables: window.__stores.model.standard.variables.map((v) => v.id).slice(0, 6),
  tables: (window.__stores.model.standard.tables ?? []).map((t) => t.id),
}))()`)
console.log('imported:', JSON.stringify(imported))
if (!imported.tables.includes('data')) { console.log('TWIN: no data table'); await browser.close(); process.exit(1) }

// 2. The Twin tab opens.
await click('[data-testid="tab-twin"]')
await sleep(400)
const panel = await page.evaluate(`(() => !!document.querySelector('[data-testid="twin-panel"]'))()`)
if (!panel) { console.log('TWIN: no panel'); await browser.close(); process.exit(1) }

// 3. The stream feeds the measured area (the reel change); the class
// register seeds by hand (the workspace's instance datum).
await page.select('[data-testid="twin-variable"]', 'area')
await page.evaluate(`(() => {
  const f = document.querySelector('[data-testid="twin-from"]')
  const t = document.querySelector('[data-testid="twin-to"]')
  const s = document.querySelector('[data-testid="twin-switch"]')
  const seeds = document.querySelector('[data-testid="twin-seeds"]')
  f.value = '1'; t.value = '1.5'; s.value = '10'; seeds.value = 'class=1'
  for (const el of [f, t, s, seeds]) el.dispatchEvent(new Event('input'))
})()`)
await click('[data-testid="twin-start"]')
await sleep(4000)

const state = await page.evaluate(`(() => ({
  clock: document.querySelector('[data-testid="twin-clock"]')?.textContent ?? null,
  ticks: document.querySelectorAll('[data-testid^="twin-tick-"]').length,
  type: document.querySelector('[data-testid="twin-reg-type"]')?.textContent ?? null,
  thickness: document.querySelector('[data-testid="twin-reg-thicknessReq"]')?.textContent ?? null,
}))()`)
console.log('twin:', JSON.stringify(state))
if (!state.clock || state.ticks < 1 || state.thickness !== '0.6') {
  console.log('TWIN FAILED')
  await browser.close()
  process.exit(1)
}
if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('TWIN OK')
await browser.close()

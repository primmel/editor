// The API-source smoke (M-API): the twin ingests LIVE measurements
// via HTTP — the endpoint answers JSON, the mappings stream it into
// the registers, the TABLE lookups derive, and changing the endpoint's
// answer changes the registers (the endpoint DRIVES the run — not the
// authored steps). The Paneron extension's dynamic-measurements-via-
// API primitive, proven in a real browser.
import puppeteer from 'puppeteer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const mobile = process.env.E2E_VIEWPORT === 'mobile'
const WIDTH = mobile ? 390 : 1400
const HEIGHT = mobile ? 844 : 950
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: WIDTH, height: HEIGHT })
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
async function text(sel: string): Promise<string | null> {
  return page.evaluate(`(() => document.querySelector(${JSON.stringify(sel)})?.textContent ?? null)()`)
}

// The demo model (the BS6004 showcase — area is measured, the data
// table looks up type/thickness by class).
const mmel = readFileSync(join(homedir(), 'src/mn/mmel-models/showcase 5/BS6004.mmel'), 'utf8')
await page.evaluate(`(async () => {
  const { importLegacy } = await import('/src/lib/mmel-import.ts')
  const result = importLegacy(${JSON.stringify(mmel)})
  window.__stores.model.loadText(result.canonical)
})()`)
await sleep(1200)

await click('[data-testid="tab-twin"]')
await sleep(300)

// 1. The API mode: endpoint + the mappings (area reads its own key,
// temp reads the named path). The measured variable is picked while
// the step config still shows — the add-mapping rows inherit it.
await page.select('[data-testid="twin-variable"]', 'area')
await click('[data-testid="twin-mode-api"]')
await sleep(200)
const urlBox = await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="twin-api-url"]')
  if (!el) return null
  el.value = '/api/measurements?t=5'
  el.dispatchEvent(new Event('input'))
  return el.value
})()`)
if (urlBox !== '/api/measurements?t=5') { console.log('API: no url box'); await browser.close(); process.exit(1) }

// Add the mapping row (area inherits the picked variable) and give
// it an explicit path — the non-empty-path form.
await click('[data-testid="twin-api-add"]')
await sleep(150)
await page.evaluate(`(() => {
  const p0 = document.querySelector('[data-testid="twin-api-path-0"]')
  p0.value = 'area'
  p0.dispatchEvent(new Event('input'))
  const dt = document.querySelector('[data-testid="twin-dt"]')
  dt.value = '2'
  dt.dispatchEvent(new Event('input'))
  const seeds = document.querySelector('[data-testid="twin-seeds"]')
  seeds.value = 'class=1'
  seeds.dispatchEvent(new Event('input'))
})()`)

// 2. Start — t=5 pins the instrument: area 1.0 (and the class=1
// seed + area 1.0 drives the table lookup to 0.6).
await click('[data-testid="twin-start"]')
await sleep(5200)

const run1 = await page.evaluate(`(() => ({
  clock: document.querySelector('[data-testid="twin-clock"]')?.textContent ?? null,
  status: document.querySelector('[data-testid="twin-api-status"]')?.textContent ?? null,
  ticks: document.querySelectorAll('[data-testid^="twin-tick-"]').length,
  area: document.querySelector('[data-testid="twin-reg-area"]')?.textContent ?? null,
  thickness: document.querySelector('[data-testid="twin-reg-thicknessReq"]')?.textContent ?? null,
}))()`)
console.log('t=5:', JSON.stringify(run1))
if (run1.area !== '1') { console.log('API FAILED: registers not from the endpoint'); await browser.close(); process.exit(1) }
if (run1.thickness !== '0.6') { console.log('API FAILED: the lookup did not derive from the streamed readings'); await browser.close(); process.exit(1) }
if (!(run1.status ?? '').includes('streaming')) { console.log('API FAILED: no streaming status'); await browser.close(); process.exit(1) }

// 3. The endpoint DRIVES the run: pin t=20 — the SAME pipeline now
// reports area 1.6 (a value the authored steps never produce).
await click('[data-testid="twin-stop"]')
await sleep(300)
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="twin-api-url"]')
  el.value = '/api/measurements?t=20'
  el.dispatchEvent(new Event('input'))
})()`)
await click('[data-testid="twin-start"]')
await sleep(5200)
const run2 = await page.evaluate(`(() => ({
  area: document.querySelector('[data-testid="twin-reg-area"]')?.textContent ?? null,
}))()`)
console.log('t=20:', JSON.stringify(run2))
if (run2.area !== '1.6') { console.log('API FAILED: the endpoint does not drive the registers'); await browser.close(); process.exit(1) }

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('API OK')
await browser.close()

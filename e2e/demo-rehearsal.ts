// The DEMO REHEARSAL (2026-10-13 prep) — walks the golden path in a
// real browser and captures the fallback screenshots: the corpus home
// (oiml-r60-lml through the package API), the digital twin on the
// BS6004 showcase, the instance store, and the mapping surfaces.
import puppeteer from 'puppeteer'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const OUT = process.env.DEMO_SHOTS ?? '/tmp/demo-shots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

const mobile = process.env.E2E_VIEWPORT === 'mobile'
const WIDTH = mobile ? 390 : 1400
const HEIGHT = mobile ? 844 : 950
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: WIDTH, height: HEIGHT })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const shot = (name: string) => page.screenshot({ path: join(OUT, name) })
const clickSel = async (sel: string) =>
  page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel}'); el.click() })()`)

// 1. THE CORPUS HOME — oiml-r60-lml through the package API (the full
//    uses closure), the evaluation canvas.
await page.evaluate(`(async () => {
  const res = await fetch('/api/package/open', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir: ${JSON.stringify(join(homedir(), 'src/oimlsmart/model-library-spike/oiml-r60-lml'))} }),
  })
  window.__stores.model.openPackage(await res.json())
})()`)
await sleep(1500)
await shot('1-corpus-home-r60.png')
console.log('step 1: the R 60 corpus home')

// 2. THE DIGITAL TWIN — the BS6004 showcase through the legacy import.
const mmel = readFileSync(join(homedir(), 'src/mn/mmel-models/showcase 5/BS6004.mmel'), 'utf8')
await page.evaluate(`(async () => {
  const { importLegacy } = await import('/src/lib/mmel-import.ts')
  window.__stores.model.loadText(importLegacy(${JSON.stringify(mmel)}).canonical)
})()`)
await sleep(1200)
await clickSel('[data-testid="tab-twin"]')
await sleep(300)
await page.select('[data-testid="twin-variable"]', 'area')
await page.evaluate(`(() => {
  for (const [sel, v] of [['[data-testid="twin-from"]', '1'], ['[data-testid="twin-to"]', '1.5'], ['[data-testid="twin-switch"]', '10'], ['[data-testid="twin-seeds"]', 'class=1']]) {
    const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input'))
  }
})()`)
await clickSel('[data-testid="twin-start"]')
await sleep(6000)
await shot('2-digital-twin-bs6004.png')
console.log('step 2: the twin over the showcase')

// 3. THE INSTANCE STORE — the workspace data on the R 60 package.
await page.evaluate(`(async () => {
  const res = await fetch('/api/package/open', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir: ${JSON.stringify(join(homedir(), 'src/oimlsmart/model-library-spike/oiml-r60-lml'))} }),
  })
  window.__stores.model.openPackage(await res.json())
})()`)
await sleep(1000)
await clickSel('[data-testid="tab-workspace"]')
await sleep(600)
await shot('3-workspace-panel.png')
console.log('step 3: the workspace')

// 4. THE MAPPING SURFACES — the repo map and the diff panel.
await page.evaluate(`(() => { window.__stores.ui.view = 'mapping' })()`)
await sleep(700)
await shot('4-mapper.png')
console.log('step 4: the mapper')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 5)); await browser.close(); process.exit(1) }
console.log('REHEARSAL OK — shots in', OUT)
await browser.close()

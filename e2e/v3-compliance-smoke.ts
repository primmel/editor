import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 compliance leg (TODO.editor wave 03, audit G6) — the
// provision-era panels bridged to real requirements: the stats pill,
// the code status line, and the compliance panel read the 34 OIML-CS
// requirements (0 provisions), the obligation filter works, and a row
// selects into the requirement inspector.
// ─────────────────────────────────────────────────────────────────────

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-COMPLIANCE FAILED:', why); await browser.close(); process.exit(1) }

// 1. The OIML-CS scheme model loads (34 requirements, 0 provisions).
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/model.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))
let state = await page.evaluate(`(() => ({
  provisions: window.__stores.model.standard.provisions.length,
  requirements: window.__stores.model.standard.requirements.length,
}))()`)
if (state.provisions !== 0 || state.requirements !== 34) await fail('the scheme model did not load')

// 2. The stats pill and the code status line read the real requirements.
state = await page.evaluate(`(() => ({
  pill: document.querySelector('[data-testid="compliance-pill"]')?.textContent?.trim() ?? null,
}))()`)
console.log('pill:', JSON.stringify(state))
if (!state.pill?.includes('34') || !state.pill?.includes('requirements')) await fail('the stats pill still reads provisions')
await page.evaluate(`(() => { window.__stores.ui.leftPanel = 'code' })()`)
await new Promise(r => setTimeout(r, 900))
state = await page.evaluate(`(() => ({
  status: document.querySelector('.success-bar')?.textContent?.trim() ?? null,
}))()`)
console.log('status line:', JSON.stringify(state))
if (!state.status?.includes('34 requirements')) await fail('the code status line still reads provisions')
await page.evaluate(`(() => { window.__stores.ui.leftPanel = 'tree' })()`)
await new Promise(r => setTimeout(r, 300))

// 3. The compliance panel lists the requirements with the obligation chips.
await page.evaluate(`(() => { window.__stores.ui.rightPanel = 'compliance' })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  surface: document.querySelector('.compliance')?.dataset?.surface ?? null,
  rows: document.querySelectorAll('.provision-item').length,
  chips: Array.from(document.querySelectorAll('.filter-bar button')).map((b) => b.textContent.trim()),
}))()`)
console.log('panel:', JSON.stringify(state))
if (state.surface !== 'requirements' || state.rows !== 34) await fail('the compliance panel did not list the requirements')
if (!state.chips.includes('all') || !state.chips.includes('shall')) await fail('the obligation chips did not render')

// 4. The filter narrows (shall keeps 34; the chip set is the model's own).
await page.evaluate(`(() => { document.querySelector('[data-testid="compliance-filter-shall"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({ rows: document.querySelectorAll('.provision-item').length }))()`)
if (state.rows !== 34) await fail('the shall filter did not hold the rows')

// 5. A row selects into the requirement inspector.
await page.evaluate(`(() => {
  const row = document.querySelector('[data-testid="compliance-row-/req/cs/sample-count"]')
  row.click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
}))()`)
if (state.selection?.type !== 'requirement') await fail('the row did not select the requirement')
await page.evaluate(`(() => { window.__stores.ui.rightPanel = 'inspector' })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="requirement-inspector"]'),
}))()`)
if (!state.inspector) await fail('the requirement inspector did not open from the compliance row')

// 6. The legacy sample model still reads provisions (the unchanged path).
await page.evaluate(`(() => { window.location.reload() })()`)
await page.waitForSelector('[data-testid="compliance-pill"]', { timeout: 8000 })
await new Promise(r => setTimeout(r, 1500))
state = await page.evaluate(`(() => ({
  pill: document.querySelector('[data-testid="compliance-pill"]')?.textContent?.trim() ?? null,
}))()`)
console.log('legacy pill:', JSON.stringify(state))
if (!state.pill?.includes('provisions')) await fail('the legacy pill did not read provisions')

console.log('V3-COMPLIANCE OK')
await browser.close()
process.exit(0)

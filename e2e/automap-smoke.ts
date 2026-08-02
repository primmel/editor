import puppeteer from 'puppeteer'

const REF_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "REF"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

process ManufactureProduct {
  name "Manufacture the product"
  actor q1
}

process QualityInspection {
  name "Quality inspection"
  actor q1
}

canvas Root {
  elements {
    ManufactureProduct { x 0 y 0 }
    QualityInspection { x 0 y 150 }
  }
  process_flow {
    E1 { from ManufactureProduct to QualityInspection }
  }
}`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

await page.evaluate(`((text) => {
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadRefText(text)
})(${JSON.stringify(REF_TEXT)})`)
await new Promise(r => setTimeout(r, 800))

// The panel lists suggestions (ManufactureProduct ≈ Manufacturing, QualityInspection ≈ QualityControl).
let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="automap-panel"]'),
  rows: document.querySelectorAll('.suggestion-row').length,
  mfg: !!document.querySelector('[data-testid="suggestion-Manufacturing-ManufactureProduct"]'),
}))()`)
console.log('suggestions:', JSON.stringify(state))
if (!state.panel || state.rows === 0 || !state.mfg) {
  console.log('AUTOMAP FAILED'); await browser.close(); process.exit(1)
}

// Confirm the Manufacturing ⇒ ManufactureProduct suggestion.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="confirm-Manufacturing-ManufactureProduct"]').click()
})()`)
await new Promise(r => setTimeout(r, 600))
state = await page.evaluate(`(() => {
  const s = window.__stores
  const profile = s.model.standard.mapProfiles.find((p) => p.namespace === 'QMS')
  const pair = profile?.mappings?.['Manufacturing']?.[0]
  return {
    target: pair?.target ?? null,
    justification: pair?.justification ?? null,
    gone: !document.querySelector('[data-testid="suggestion-Manufacturing-ManufactureProduct"]'),
  }
})()`)
console.log('confirmed:', JSON.stringify(state))
if (state.target !== 'QMS#ManufactureProduct' || !state.justification?.includes('auto-suggested')
  || !state.justification?.includes('confirmed by operator') || !state.gone) {
  console.log('AUTOMAP FAILED'); await browser.close(); process.exit(1)
}

// Reject the QualityControl ⇒ QualityInspection suggestion — never re-suggested.
const rejected = await page.evaluate(`(() => {
  const row = document.querySelector('[data-testid="suggestion-QualityControl-QualityInspection"]')
  if (!row) return { had: false }
  document.querySelector('[data-testid="reject-QualityControl-QualityInspection"]').click()
  return { had: true }
})()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  gone: !document.querySelector('[data-testid="suggestion-QualityControl-QualityInspection"]'),
}))()`)
console.log('rejected:', JSON.stringify({ ...rejected, ...state }))

const ok = rejected.had && state.gone
console.log(ok ? 'AUTOMAP OK' : 'AUTOMAP FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

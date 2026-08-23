import puppeteer from 'puppeteer'

// The R 7 tutorial model, live in the Studio (TODO.editor/26):
// the OIML plugin activates, the certificate preview renders the
// subject, the doc map resolves against the real R 7 document, and
// the workflow simulates to the verdict.

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// Load the R 7 model (the vendored demo file via the dev server).
await page.evaluate(`(async () => {
  const res = await fetch('/demo/r7-clinical-thermometer/model.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))

// 1. The OIML plugin activates + the certificate preview renders.
let state = await page.evaluate(`(() => ({
  pluginPalette: !!document.querySelector('.palette-title.program'),
  certButton: !!document.querySelector('[data-testid="open-panel-certificate-preview"]'),
  subjects: window.__stores.model.standard.subjects.map((s) => s.id),
}))()`)
console.log('plugin:', JSON.stringify(state))
if (!state.pluginPalette || !state.certButton || !state.subjects.includes('ClinicalThermometer')) {
  console.log('R7 FAILED'); await browser.close(); process.exit(1)
}
await page.evaluate(`(() => {
  document.querySelector('[data-testid="open-panel-certificate-preview"]').click()
})()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  cert: !!document.querySelector('[data-testid="cert-ClinicalThermometer"]'),
  hasMPE: document.querySelector('[data-testid="cert-ClinicalThermometer"]')?.textContent.includes('maximum_permissible_error_high') ?? false,
}))()`)
console.log('certificate:', JSON.stringify(state))
if (!state.cert || !state.hasMPE) { console.log('R7 FAILED'); await browser.close(); process.exit(1) }
await page.evaluate(`(() => { document.querySelector('.panel-modal-head button').click() })()`)
await new Promise(r => setTimeout(r, 300))

// 2. The doc map: load the real R 7 document in doc mode — the pairs'
//    targets show mapped on the statements.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/r7-clinical-thermometer/document.presentation.xml?raw')
  const text = await res.text()
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadDocumentText(text)
})()`)
await new Promise(r => setTimeout(r, 900))
state = await page.evaluate(`(() => ({
  docMode: !!document.querySelector('[data-testid="document-view"]'),
  urn: document.querySelector('.doc-urn')?.textContent ?? null,
  mappedStatements: document.querySelectorAll('.doc-statement.mapped').length,
  overlayEdges: document.querySelectorAll('.mapper-overlay .map-edge').length,
}))()`)
console.log('doc map:', JSON.stringify(state))
// (9 statements mapped; the overlay draws for the canvas-placed IMP
// ends — the two processes; requirements/tests are not canvas nodes.)
if (!state.docMode || state.urn !== 'urn:oiml:pub:r:7:1979' || state.mappedStatements < 8 || state.overlayEdges < 2) {
  console.log('R7 FAILED'); await browser.close(); process.exit(1)
}

// 3. The workflow simulates to the verdict.
await page.evaluate(`(() => {
  const s = window.__stores
  s.ui.view = 'model'
  s.ui.rightPanel = 'simulation'
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-start"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  const amb = document.querySelector('[data-testid="register-ambient_temperature"]')
  amb.value = '22'
  amb.dispatchEvent(new Event('change', { bubbles: true }))
  const err = document.querySelector('[data-testid="register-error_of_indication"]')
  err.value = '0.05'
  err.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-continue"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  done: !!document.querySelector('[data-testid="sim-done"]'),
  steps: Array.from(document.querySelectorAll('.trajectory-node')).map((n) => n.textContent),
}))()`)
console.log('simulation:', JSON.stringify(state))

const ok = state.done && state.steps.includes('ErrorDetermination') && state.steps.includes('IssueVerdict')
console.log(ok ? 'R7 OK' : 'R7 FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

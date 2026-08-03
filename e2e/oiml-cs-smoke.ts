import puppeteer from 'puppeteer'

// The OIML-CS demo, live in the Studio (TODO.editor/39): the scheme
// model opens with its 34 PD-05 requirements, the doc map resolves
// against the real PD-05 mirror, and the certification workflow
// simulates application → certificate → BIML registration.

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why) => {
  console.log(`OIML-CS FAILED (${why})`)
  await browser.close()
  process.exit(1)
}

// 1. The certification workflow opens and simulates to registration.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/certification.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))

let state = await page.evaluate(`(() => ({
  processes: window.__stores.model.standard.processes.map((p) => p.id),
  view: (() => { const s = window.__stores; s.ui.view = 'model'; s.ui.rightPanel = 'simulation'; return true })(),
}))()`)
if (!state.processes.includes('RegisterCertificate')) await fail('model did not open')
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-start"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  for (const [name, value] of [['application_complete', '1'], ['tests_passed', '1'], ['evaluation_approved', '1']]) {
    const el = document.querySelector('[data-testid="register-' + name + '"]')
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-continue"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  done: !!document.querySelector('[data-testid="sim-done"]'),
  steps: Array.from(document.querySelectorAll('.trajectory-node')).map((n) => n.textContent),
}))()`)
console.log('simulation:', JSON.stringify(state))
if (!state.done || !state.steps.includes('IssueCertificate') || !state.steps.includes('RegisterCertificate')) {
  await fail('workflow did not reach BIML registration')
}

// 2. The scheme model's doc map resolves against the real PD-05 mirror.
await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/model.prl?raw')
  const text = await res.text()
  window.__stores.model.loadText(text)
})()`)
await new Promise(r => setTimeout(r, 800))
state = await page.evaluate(`(() => ({
  requirements: window.__stores.model.standard.requirements.length,
  pluginPalette: !!document.querySelector('.palette-title.program'),
}))()`)
console.log('scheme model:', JSON.stringify(state))
if (state.requirements !== 34) await fail('the scheme model did not open')

await page.evaluate(`(async () => {
  const res = await fetch('/demo/oiml-cs/oiml-cs-pd-05.mirror.json?raw')
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
}))()`)
console.log('doc map:', JSON.stringify(state))
// (47 pairs land on 45 distinct PD-05 statements; the map sources are
// requirements — not canvas nodes — so no overlay edges are drawn.)
const ok = state.docMode && state.urn === 'urn:oiml:pub:cs:pd-05:2024' && state.mappedStatements >= 40
console.log(ok ? 'OIML-CS OK' : 'OIML-CS FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

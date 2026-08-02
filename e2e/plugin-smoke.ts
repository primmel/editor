import puppeteer from 'puppeteer'

const OIML_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "Load cells"
  schema "Primmel 0.1"
  namespace "OIML.R60"
}

role r1 { name "R1" }

subject LoadCell {
  is {
    metadata {
      name "Load cell"
    }
    design_parameters {
      accuracy_class "C3"
      capacity "30 kg"
    }
  }
}

canvas Root {
  elements {
  }
  process_flow {
  }
}`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The plain sample: NO program palette section, NO panel button.
let state = await page.evaluate(`(() => ({
  programPalette: !!document.querySelector('.palette-title.program'),
  certButton: !!document.querySelector('[data-testid="open-panel-certificate-preview"]'),
}))()`)
console.log('plain model:', JSON.stringify(state))
if (state.programPalette || state.certButton) {
  console.log('PLUGIN FAILED (leak)'); await browser.close(); process.exit(1)
}

// 2. Load an OIML model → the program palette + the panel button appear.
await page.evaluate(`((text) => {
  window.__stores.model.loadText(text)
})(${JSON.stringify(OIML_TEXT)})`)
await new Promise(r => setTimeout(r, 700))
state = await page.evaluate(`(() => ({
  programPalette: !!document.querySelector('.palette-title.program'),
  entries: Array.from(document.querySelectorAll('.palette-title.program ~ .palette-list .palette-item')).map((el) => el.textContent.trim()),
  certButton: !!document.querySelector('[data-testid="open-panel-certificate-preview"]'),
}))()`)
console.log('oiml model:', JSON.stringify(state))
if (!state.programPalette || state.entries.length !== 4 || !state.certButton) {
  console.log('PLUGIN FAILED'); await browser.close(); process.exit(1)
}

// 3. The requirement palette creates a requirement.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="palette-plugin-requirement"]').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  requirements: window.__stores.model.standard.requirements.map((r) => r.id),
}))()`)
console.log('requirement:', JSON.stringify(state))
if (state.requirements.length !== 1) { console.log('PLUGIN FAILED'); await browser.close(); process.exit(1) }

// 4. The certificate preview renders the subject.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="open-panel-certificate-preview"]').click()
})()`)
await new Promise(r => setTimeout(r, 500))
state = await page.evaluate(`(() => ({
  modal: !!document.querySelector('[data-testid="panel-certificate-preview"]'),
  card: !!document.querySelector('[data-testid="cert-LoadCell"]'),
  hasClass: document.querySelector('[data-testid="cert-LoadCell"]')?.textContent.includes('accuracy_class') ?? false,
}))()`)
console.log('certificate:', JSON.stringify(state))

const ok = state.modal && state.card && state.hasClass
console.log(ok ? 'PLUGIN OK' : 'PLUGIN FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

import puppeteer from 'puppeteer'

const REF_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "QMS Reference"
  schema "Primmel 0.1"
  namespace "QMS"
}

role q1 { name "Auditor" }

start_event Start { }

process MakeGood {
  name "Make good product"
  actor q1
}

process CheckGood {
  name "Check it is good"
  actor q1
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    MakeGood { x 0 y 100 }
    CheckGood { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to MakeGood }
    E2 { from MakeGood to CheckGood }
  }
}`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Switch to the mapping view, load the reference via the store hook.
await page.evaluate((text: string) => {
  const s = (window as any).__stores
  s.ui.view = 'mapping'
  s.mapping.loadRefText(text)
}, REF_TEXT)
await new Promise(r => setTimeout(r, 800))

let state = await page.evaluate(() => ({
  ns: document.querySelector('[data-testid="ref-namespace"]')?.textContent ?? null,
  refNodes: document.querySelectorAll('[data-testid="ref-pane"] .node-group').length,
  impNodes: document.querySelectorAll('[data-testid="imp-pane"] .node-group').length,
}))
console.log('loaded:', JSON.stringify(state))
if (state.ns !== 'QMS' || state.refNodes !== 3 || state.impNodes !== 3) {
  console.log('MAPPER FAILED'); await browser.close(); process.exit(1)
}

// 2. Click REF MakeGood → IMP Manufacturing → the pair dialog opens.
await page.evaluate(() => {
  const node = document.querySelector('[data-testid="ref-pane"] [data-node-id="MakeGood"]') as HTMLElement
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 300))
await page.evaluate(() => {
  const node = document.querySelector('[data-testid="imp-pane"] [data-node-id="Manufacturing"]') as HTMLElement
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  dialog: !!document.querySelector('[data-testid="pair-dialog"]'),
}))
console.log('dialog:', JSON.stringify(state))
if (!state.dialog) { console.log('MAPPER FAILED'); await browser.close(); process.exit(1) }

// 3. Fill the meta and confirm.
await page.evaluate(() => {
  const d = document.querySelector('[data-testid="pair-description"]') as HTMLTextAreaElement
  d.value = 'Manufacture fulfils MakeGood'
  d.dispatchEvent(new Event('input', { bubbles: true }))
  const j = document.querySelector('[data-testid="pair-justification"]') as HTMLTextAreaElement
  j.value = 'same outcome, clause 4.1'
  j.dispatchEvent(new Event('input', { bubbles: true }))
  ;(document.querySelector('[data-testid="pair-confirm"]') as HTMLElement).click()
})
await new Promise(r => setTimeout(r, 600))
state = await page.evaluate(() => {
  const s = (window as any).__stores
  const profile = s.model.standard.mapProfiles.find((p: any) => p.namespace === 'QMS')
  return {
    pairs: profile?.mappings?.['Manufacturing']?.map((p: any) => ({ target: p.target, description: p.description, justification: p.justification })) ?? null,
    edge: !!document.querySelector('[data-testid="map-edge-Manufacturing"]'),
    mappedRow: !!document.querySelector('[data-testid="party-source-mapped-Manufacturing"]'),
    refMappedRow: !!document.querySelector('[data-testid="party-target-mapped-MakeGood"]'),
  }
})
console.log('mapped:', JSON.stringify(state))
if (!state.pairs?.length || state.pairs[0].target !== 'QMS#MakeGood'
  || state.pairs[0].description !== 'Manufacture fulfils MakeGood'
  || !state.edge || !state.mappedRow || !state.refMappedRow) {
  console.log('MAPPER FAILED'); await browser.close(); process.exit(1)
}

// 4. Multi-target: REF CheckGood → IMP Manufacturing too.
await page.evaluate(() => {
  ;(document.querySelector('[data-testid="ref-pane"] [data-node-id="CheckGood"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 300))
await page.evaluate(() => {
  ;(document.querySelector('[data-testid="imp-pane"] [data-node-id="Manufacturing"]') as HTMLElement)
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 300))
await page.evaluate(() => (document.querySelector('[data-testid="pair-confirm"]') as HTMLElement).click())
await new Promise(r => setTimeout(r, 600))
state = await page.evaluate(() => {
  const s = (window as any).__stores
  const profile = s.model.standard.mapProfiles.find((p: any) => p.namespace === 'QMS')
  return {
    targets: profile?.mappings?.['Manufacturing']?.map((p: any) => p.target) ?? [],
    unmappedRef: !!document.querySelector('[data-testid="party-target-unmapped-q1"]'),
  }
})
console.log('multi-target:', JSON.stringify(state))

const ok = state.targets.length === 2
  && state.targets.includes('QMS#MakeGood') && state.targets.includes('QMS#CheckGood')
  && state.unmappedRef
console.log(ok ? 'MAPPER OK' : 'MAPPER FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

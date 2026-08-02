import puppeteer from 'puppeteer'

const LEGACY = `root root

version "v1.0.0-dev1"

metadata {
  title "Legacy Demo"
  schema "MMEL 0.1"
  namespace "LegacyDemo"
}

role operator { name "Operator" }

start_event Start { }
end_event Done { }

process OldStep {
  name "Old step"
  actor operator
  modality SHALL
  subprocess Page1
}

process InnerStep {
  name "Inner step"
  actor operator
}

measurement legacyVar {
  type float
  definition "A legacy measurement"
}

subprocess Page1 {
  elements {
    Start { x 0 y 0 }
    InnerStep { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to InnerStep }
    E2 { from InnerStep to Done }
  }
}

canvas root {
  elements {
    Start { x 0 y 0 }
    OldStep { x 0 y 100 }
    Done { x 0 y 200 }
  }
  process_flow {
    E3 { from Start to OldStep }
    E4 { from OldStep to Done }
  }
}`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The import panel opens.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-import"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="import-panel"]'),
  pick: !!document.querySelector('[data-testid="import-pick"]'),
}))()`)
console.log('panel:', JSON.stringify(state))
if (!state.panel || !state.pick) { console.log('IMPORT FAILED'); await browser.close(); process.exit(1) }

// 2. The conversion runs in-browser; the report renders; the model swaps.
await page.evaluate(`(async () => {
  const { importLegacy } = await import('/src/lib/mmel-import.ts')
  const result = importLegacy(${JSON.stringify(LEGACY)})
  window.__importResult = result
  // the panel's confirm path: the store replaces the working model
  window.__stores.model.loadText(result.canonical)
})()`)
await new Promise(r => setTimeout(r, 700))
state = await page.evaluate(`(() => {
  const s = window.__stores
  return {
    processes: s.model.standard.processes.map((p) => p.id),
    variables: s.model.standard.variables.map((v) => v.id),
    pages: s.model.standard.pages.map((p) => p.id),
    nodeOldStep: !!document.querySelector('[data-node-id="OldStep"]'),
    renames: window.__importResult.report.renames,
    unknown: window.__importResult.report.unknownKeywords,
    validation: window.__importResult.report.validationIssues,
  }
})()`)
console.log('imported:', JSON.stringify(state))

const ok = state.processes.includes('OldStep') && state.processes.includes('InnerStep')
  && state.variables.includes('legacyVar')
  && state.pages.includes('Page1') && state.nodeOldStep
  && state.renames.length === 2 && state.unknown.length === 0 && state.validation.length === 0
console.log(ok ? 'IMPORT OK' : 'IMPORT FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

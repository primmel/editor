// The .sdc document-mapping leg (the audit's close): the SIMPLE
// document format loads through the SAME document plane as the
// metanorma XML — the doc view renders its clauses, a statement
// pairs to an IMP element, the pair targets the statement's URN.
import puppeteer from 'puppeteer'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FIXTURE = join(homedir(), 'src/mn/mmel-models/dptm.sdc')
if (!existsSync(FIXTURE)) {
  console.log('DOC-SDC SKIPPED (no corpus fixture)')
  process.exit(0)
}

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "DPTM implementation"
  schema "Primmel 0.1"
  namespace "dptm-imp"
}

start_event Start { }

process Governance {
  name "Maintain data protection policies"
  modality shall
}

end_event Done { }

canvas Root {
  elements {
    Start { x 0 y 0 }
    Governance { x 0 y 120 }
    Done { x 0 y 240 }
  }
  process_flow {
    E1 { from Start to Governance }
    E2 { from Governance to Done }
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('DOC-SDC FAILED:', why); await browser.close(); process.exit(1) }

// 1. The implementation loads; the .sdc document enters the mapping view.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 800))
const sdc = readFileSync(FIXTURE, 'utf8')
await page.evaluate(`(() => {
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadDocumentText(${JSON.stringify(sdc)})
})()`)
await new Promise((r) => setTimeout(r, 800))

const doc = await page.evaluate(`(() => ({
  view: !!document.querySelector('[data-testid="document-view"]'),
  ns: document.querySelector('[data-testid="ref-namespace"]')?.textContent ?? null,
  stmts: document.querySelectorAll('.doc-statement').length,
  first: document.querySelector('.doc-statement .stmt-text')?.textContent ?? null,
}))()`)
console.log('sdc document:', JSON.stringify(doc))
if (!doc.view || doc.ns !== 'DPTM-doc') await fail(`the .sdc document did not load: ${JSON.stringify(doc)}`)
if (doc.stmts < 3) await fail(`expected the wrapped 1.1.1 statement among others, got ${doc.stmts}`)
if (!doc.first?.includes('data protection policies')) await fail('the first statement text is wrong')

// 2. Pair the 1.1.1 statement to the Governance process.
await page.evaluate(`(() => {
  const stmts = [...document.querySelectorAll('.doc-statement')]
  const target = stmts.find((s) => s.textContent?.includes('data protection policies'))
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="imp-pane"] [data-node-id="Governance"]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise((r) => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="pair-confirm"]')?.click() })()`)
await new Promise((r) => setTimeout(r, 600))

const mapped = await page.evaluate(`(() => {
  const profile = window.__stores.model.standard.mapProfiles.find((p) => p.namespace === 'DPTM-doc')
  return {
    target: profile?.mappings?.['Governance']?.[0]?.target ?? null,
    stmtMapped: [...document.querySelectorAll('.doc-statement')].some((s) =>
      s.textContent?.includes('data protection policies') && s.className.includes('mapped')),
    edge: !!document.querySelector('[data-testid="map-edge-Governance"]'),
  }
})()`)
console.log('sdc mapped:', JSON.stringify(mapped))
if (!mapped.target?.startsWith('DPTM-doc#1.1.1')) await fail(`the pair did not target the 1.1.1 URN: ${mapped.target}`)
if (!mapped.stmtMapped || !mapped.edge) await fail('the statement did not render mapped with the edge')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('DOC-SDC OK')
await browser.close()

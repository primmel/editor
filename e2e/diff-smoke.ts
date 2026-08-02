import puppeteer from 'puppeteer'

// B: Manufacturing renamed, Done removed, Ship added, plus a map profile.
const B_TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "Manufacturing Pipeline"
  schema "Primmel 0.1"
  namespace "Manufacturing"
}

role Factory { name "Factory" }
role AssemblyLine { name "Assembly Line" }
role QA { name "Quality Assurance" }

start_event Start { }

process Manufacturing {
  name "Manufacture product v2"
  actor Factory

  process Assembly {
    name "Assemble components"
    actor AssemblyLine
  }

  process QualityControl {
    name "Inspect quality"
    actor QA
  }
}

process Ship {
  name "Ship product"
  actor Factory
}

canvas Root {
  elements {
    Start           { x 0 y 0 }
    Manufacturing   { x 0 y 100 }
    Ship            { x 0 y 200 }
  }
  process_flow {
    E1 { from Start to Manufacturing }
    E2 { from Manufacturing to Ship }
  }
}

map_profile QMS {
  mapping {
    Ship -> QMS#DeliverGood { description "new pair" }
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
  s.ui.view = 'diff'
  s.diff.loadOtherText(text, 'v2.prl')
})(${JSON.stringify(B_TEXT)})`)
await new Promise(r => setTimeout(r, 800))

let state = await page.evaluate(`(() => ({
  summary: document.querySelector('[data-testid="diff-summary"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  addedRow: !!document.querySelector('[data-testid="diff-row-added-Ship"]'),
  removedRow: !!document.querySelector('[data-testid="diff-row-removed-Done"]'),
  changedRow: !!document.querySelector('[data-testid="diff-row-changed-Manufacturing"]'),
}))()`)
console.log('diff:', JSON.stringify(state))
if (!state.summary || !state.addedRow || !state.removedRow || !state.changedRow) {
  console.log('DIFF FAILED'); await browser.close(); process.exit(1)
}

// Expand the changed row → the facet before/after shows the rename.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="diff-row-changed-Manufacturing"]').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => {
  const facets = Array.from(document.querySelectorAll('.diff-facet'))
  return {
    texts: facets.map((f) => f.textContent.replace(/\\s+/g, ' ').trim()),
    mappingRow: Array.from(document.querySelectorAll('.diff-mapping')).map((m) => m.textContent.trim()),
    shipNode: !!document.querySelector('.diff-canvas [data-node-id="Ship"]'),
    doneTint: document.querySelector('.diff-canvas [data-node-id="Done"]')?.getAttribute('style') ?? null,
    mfgTint: document.querySelector('.diff-canvas [data-node-id="Manufacturing"]')?.getAttribute('style') ?? null,
  }
})()`)
console.log('facets:', JSON.stringify(state, null, 1))

const hasRename = state.texts.some((t) => t.includes('Manufacture product') && t.includes('v2'))
const hasMapping = state.mappingRow.some((m) => m.includes('Ship ⇒ QMS#DeliverGood'))
// Ship is absent from the working model (added side — list only);
// Done (removed) tints red; Manufacturing (changed) tints amber.
const ok = hasRename && hasMapping
  && !state.shipNode
  && !!state.doneTint?.includes('rgb(184, 85, 85)')
  && !!state.mfgTint?.includes('rgb(212, 148, 66)')
console.log(ok ? 'DIFF OK' : 'DIFF FAILED')
await browser.close()
process.exit(ok ? 0 : 1)

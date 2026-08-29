import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 tables leg (TODO.editor wave 03) — the lookup-table surface on
// the live app: the tree section, the inspector (columns + the data
// grid), edits through the command path, and the in-tree create. The
// corpus text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `table mpe_tiers {
  description "MPE tier breakpoints per accuracy class (R 60-1, Table 4)"
  columns {
    accuracy_class: string
    load_min: number "v"
    load_max: number "v"
    limit_factor: number
  }
  data {
    "A" 0 50000 0.5
    "B" 0 5000 0.5
    "C" 0 500 0.5
  }
}

table test_runs {
  description "Load applications per test point by accuracy class"
  columns {
    accuracy_class: string
    runs: integer
  }
  data {
    "A" 5
    "C" 3
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-TABLES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the Tables section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  tables: window.__stores.model.standard.tables.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Tables')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.tables !== 2 || state.group !== 'Tables (2) +') await fail('the Tables tree section did not render')

// 2. Selecting a table opens its inspector with the columns and the grid.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'mpe_tiers')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="table-inspector"]'),
  description: document.querySelector('[data-testid="table-description"]')?.value?.slice(0, 30) ?? null,
  columns: Array.from(document.querySelectorAll('.column-row .column-name')).map((n) => n.textContent),
  cell00: document.querySelector('[data-testid="table-cell-0-0"]')?.value ?? null,
  cell13: document.querySelector('[data-testid="table-cell-1-3"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || !state.description?.startsWith('MPE tier breakpoints')
  || JSON.stringify(state.columns) !== JSON.stringify(['accuracy_class', 'load_min', 'load_max', 'limit_factor'])
  || state.cell00 !== 'A' || state.cell13 !== '0.5') await fail('the table inspector did not open with the facets')

// 3. A cell edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="table-cell-0-3"]')
  el.value = '0.6'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  cell: window.__stores.model.standard.tables.find((t) => t.id === 'mpe_tiers')?.data[0]?.[3],
  serialized: window.__stores.model.serialize().includes('"A" "0" "50000" "0.6"'),
}))()`)
if (state.cell !== '0.6' || !state.serialized) await fail('the cell edit did not land')

// 4. A row adds through the grid.
await page.evaluate(`(() => { document.querySelector('[data-testid="table-row-add"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  rows: window.__stores.model.standard.tables.find((t) => t.id === 'mpe_tiers')?.data.length,
  newRowCells: document.querySelector('[data-testid="table-cell-3-0"]')?.value ?? null,
}))()`)
if (state.rows !== 4 || state.newRowCells !== '') await fail('the row add did not land')

// 5. The in-tree create mints a table and selects it for editing.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-table"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.tables.map((t) => t.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="table-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Table1') || state.selection?.id !== 'Table1' || !state.inspector)
  await fail('the in-tree create did not mint + select the table')

console.log('V3-TABLES OK')
await browser.close()
process.exit(0)

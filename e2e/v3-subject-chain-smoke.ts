import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 subject-chain leg (TODO.editor wave 03) — behaviors,
// capabilities, condition sets, and verdicts on the live app: the tree
// sections, the inspectors, edits through the command path, and the
// in-tree creates. The corpus text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load (R 60-1, 3.4.4)."
}

capability gas-analytical-system {
  label "Gas Analytical System"
  description "Base capability — all gas analytical systems have this."
  has_parameters { measurand_components mpe }
}

condition_set ref-conditions {
  role reference
  subject GasAnalyticalSystem
  entries {
    temperature { value "20" unit "degC" tolerance "5" note "Reference temperature" }
  }
  ref derives-from "urn:oiml:pub:r:144-1:2013#clause-8"
}

verdict creep {
  symbol "C_C"
  behavior creep
  quantity { kind verification_interval unit "v" }
  derive "ocl{abs(c_c)}"
  inputs { c_c }
  ref derives-from "urn:oiml:pub:r:60-3:2021#clause-2.1.5"
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-SUBJECT-CHAIN FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the four tree sections render.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()),
}))()`)
const want = ['Behaviors (1) +', 'Capabilities (1) +', 'Condition Sets (1) +', 'Verdicts (1) +']
console.log('tree:', JSON.stringify(state.groups.filter(g => want.some(w => g.startsWith(w.split(' ')[0])))))
if (!want.every(w => state.groups.includes(w))) await fail('the subject-chain tree sections did not render')

const click = async (id) => page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === ${JSON.stringify(id)})
  item.closest('li').click()
})()`)

// 2. The behavior inspector opens and edits.
await click('creep')
await new Promise(r => setTimeout(r, 300))
// Two constructs share the id 'creep' (the behavior AND the verdict) —
// the tree's Behaviors row is the one under its own group header.
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="behavior-inspector"]') || !!document.querySelector('[data-testid="verdict-inspector"]'),
}))()`)
if (!state.inspector) await fail('neither inspector opened for creep')

// Drive the behavior row precisely: the Behaviors group, then its row.
await page.evaluate(`(() => {
  const groups = Array.from(document.querySelectorAll('.tree-group'))
  const g = groups.find((el) => el.querySelector('.group-header')?.textContent?.startsWith('Behaviors'))
  g.querySelector('.group-items li').click()
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="behavior-inspector"]'),
  kind: document.querySelector('[data-testid="behavior-kind"]')?.value ?? null,
  response: document.querySelector('[data-testid="behavior-response"]')?.value?.startsWith('Change in load cell output') ?? false,
}))()`)
console.log('behavior:', JSON.stringify(state))
if (!state.inspector || state.kind !== 'temporal' || !state.response) await fail('the behavior inspector did not open with the facets')
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="behavior-stimulus"]')
  el.value = 'force (constant)'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  stimulus: window.__stores.model.standard.behaviors[0].stimulus,
  // The dump writes bare-safe values unquoted (parens are bare-safe).
  serialized: window.__stores.model.serialize().includes('stimulus force (constant)'),
}))()`)
if (state.stimulus !== 'force (constant)' || !state.serialized) await fail('the behavior edit did not land')

// 3. The capability inspector opens and edits a list facet.
await page.evaluate(`(() => {
  const groups = Array.from(document.querySelectorAll('.tree-group'))
  const g = groups.find((el) => el.querySelector('.group-header')?.textContent?.startsWith('Capabilities'))
  g.querySelector('.group-items li').click()
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="capability-inspector"]'),
  label: document.querySelector('[data-testid="capability-label"]')?.value ?? null,
}))()`)
console.log('capability:', JSON.stringify(state))
if (!state.inspector || state.label !== 'Gas Analytical System') await fail('the capability inspector did not open')

// 4. The condition set inspector opens; an entry edit lands.
await page.evaluate(`(() => {
  const groups = Array.from(document.querySelectorAll('.tree-group'))
  const g = groups.find((el) => el.querySelector('.group-header')?.textContent?.startsWith('Condition Sets'))
  g.querySelector('.group-items li').click()
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="condition-set-inspector"]'),
  role: document.querySelector('[data-testid="cs-role"]')?.value ?? null,
  value: document.querySelector('[data-testid="cs-entry-value-temperature"]')?.value ?? null,
}))()`)
console.log('condition set:', JSON.stringify(state))
if (!state.inspector || state.role !== 'reference' || state.value !== '20') await fail('the condition set inspector did not open with the entries')
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="cs-entry-value-temperature"]')
  el.value = '21'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  value: window.__stores.model.standard.conditionSets[0].entries[0].value,
}))()`)
if (state.value !== '21') await fail('the condition entry edit did not land')

// 5. The verdict inspector opens with the derivation chain.
await page.evaluate(`(() => {
  const groups = Array.from(document.querySelectorAll('.tree-group'))
  const g = groups.find((el) => el.querySelector('.group-header')?.textContent?.startsWith('Verdicts'))
  g.querySelector('.group-items li').click()
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="verdict-inspector"]'),
  symbol: document.querySelector('[data-testid="verdict-symbol"]')?.value ?? null,
  derive: document.querySelector('[data-testid="verdict-derive"]')?.value ?? null,
  sourceClause: document.querySelector('[data-testid="verdict-source-clause"]')?.value ?? null,
}))()`)
console.log('verdict:', JSON.stringify(state))
if (!state.inspector || state.symbol !== 'C_C' || state.derive !== 'ocl{abs(c_c)}' || state.sourceClause !== '2.1.5')
  await fail('the verdict inspector did not open with the facets')

// 6. The in-tree creates mint + select (one per kind).
for (const [type, prefix] of [['behavior', 'Behavior1'], ['capability', 'Capability1'], ['conditionSet', 'CondSet1'], ['verdict', 'Verdict1']]) {
  await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-' + '${type}' + '"]').click() })()`)
  await new Promise(r => setTimeout(r, 250))
  state = await page.evaluate(`(() => ({
    selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  }))()`)
  if (state.selection?.id !== prefix) await fail(`the ${type} create did not mint ${prefix}`)
}

console.log('V3-SUBJECT-CHAIN OK')
await browser.close()
process.exit(0)

import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 state machines leg (TODO.editor wave 03) — the machine surface
// on the live app: the tree section, the inspector (kind, states with
// rename re-pointing transitions, initial, transitions), and the
// in-tree create. The corpus text travels from node.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `state_machine LoadCellOperational {
  kind operational
  initial off
  states {
    off
    warming
    ready
  }
  transition off -> warming action power_on
  transition warming -> ready action warm_up_complete {
    guard "elapsed since power_on >= warm_up_time"
  }
  transition [warming, ready] -> off action power_off
}

state_machine ApplicationLifecycle {
  kind lifecycle
  initial draft
  states {
    draft
    submitted
  }
  transition draft -> submitted action submit
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-STATE-MACHINES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the State Machines section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  machines: window.__stores.model.standard.stateMachines.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('State Machines')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.machines !== 2 || state.group !== 'State Machines (2) +') await fail('the State Machines tree section did not render')

// 2. Selecting a machine opens its inspector: kind, states (the initial
//    marked), the expanded transitions.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'LoadCellOperational')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="state-machine-inspector"]'),
  kind: document.querySelector('[data-testid="sm-kind"]')?.value ?? null,
  initial: document.querySelector('[data-testid="sm-initial"]')?.value ?? null,
  states: Array.from(document.querySelectorAll('.state-row input')).map((n) => n.value),
  transitions: document.querySelectorAll('.transition-row').length,
  guard1: document.querySelector('[data-testid="sm-tr-guard-1"]')?.value?.startsWith('elapsed since power_on') ?? false,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.kind !== 'operational' || state.initial !== 'off'
  || JSON.stringify(state.states) !== JSON.stringify(['off', 'warming', 'ready'])
  || state.transitions !== 4 || !state.guard1)
  await fail('the state machine inspector did not open with the facets')

// 3. A state rename re-points the transition endpoints in one command.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="sm-state-off"]')
  el.value = 'powered_down'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => {
  const m = window.__stores.model.standard.stateMachines.find((s) => s.entityName === 'LoadCellOperational')
  return {
    states: m.states.map((s) => s.name),
    initial: m.initialState,
    transitions: m.transitions.map((t) => t.from + '->' + t.to),
    serialized: window.__stores.model.serialize().includes('transition [warming, ready] -> powered_down action power_off'),
  }
})()`)
console.log('renamed:', JSON.stringify(state))
if (state.initial !== 'powered_down' || !state.transitions.includes('powered_down->warming')
  || !state.transitions.includes('warming->powered_down') || !state.serialized)
  await fail('the rename did not re-point the machine')

// 3b. One undo restores the whole machine (the rename is ONE unit).
await page.evaluate(`(() => { window.__stores.model.undo() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => {
  const m = window.__stores.model.standard.stateMachines.find((s) => s.entityName === 'LoadCellOperational')
  return { states: m.states.map((s) => s.name), initial: m.initialState }
})()`)
if (JSON.stringify(state.states) !== JSON.stringify(['off', 'warming', 'ready']) || state.initial !== 'off')
  await fail('the rename undo did not restore the machine')

// 4. A transition adds through the row editor.
await page.evaluate(`(() => { document.querySelector('[data-testid="sm-tr-add"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  transitions: window.__stores.model.standard.stateMachines.find((s) => s.entityName === 'LoadCellOperational')?.transitions.length,
}))()`)
if (state.transitions !== 5) await fail('the transition add did not land')

// 5. The in-tree create mints a machine (with its seeded initial state)
//    and selects it for editing.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-stateMachine"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.stateMachines.map((s) => s.entityName),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="state-machine-inspector"]'),
  seeded: window.__stores.model.standard.stateMachines.find((s) => s.entityName === 'Machine1')?.initialState ?? null,
  reparses: (() => { try { return !!window.__stores.model.parseError === false } catch { return false } })(),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('Machine1') || state.selection?.id !== 'Machine1' || !state.inspector || state.seeded !== 'initial')
  await fail('the in-tree create did not mint + select the machine')

console.log('V3-STATE-MACHINES OK')
await browser.close()
process.exit(0)

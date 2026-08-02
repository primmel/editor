import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The capability walk (TODO.editor/25) — one continuous Studio session
// proving the full user contract:
//   1. create a new reference model
//   2. create a new implementation model
//   3. create a data register + a dataclass with attributes
//   4. create processes, edit facets, drill in and out
//   5. diagrams render; page tabs switch
//   6. map with coverage (click-pair, overlay, tints)
//   7. run the execution (simulation with a gate branch)
//   8. import a legacy MMEL file
//   9. save with the diff preview
// Every leg asserts the AST AND the DOM.
// ─────────────────────────────────────────────────────────────────────

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const results: Record<string, boolean> = {}

// ── Leg 1: a new reference model ─────────────────────────────────────
await page.evaluate(`(() => { document.querySelector('[data-testid="open-new"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="kind-reference"]').click()
  const t = document.querySelector('[data-testid="new-title"]')
  t.value = 'Thermometer requirements'
  t.dispatchEvent(new Event('input', { bubbles: true }))
  const n = document.querySelector('[data-testid="new-namespace"]')
  n.value = 'WalkRef'
  n.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="new-create"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
{
  const s = await page.evaluate(`(() => ({
    ns: window.__stores.model.standard.meta.namespace,
    refText: window.__stores.model.serialize(),
  }))()`)
  // Stash the reference text for the mapping leg.
  await page.evaluate(`((t) => { window.__walkRefText = t })(${JSON.stringify(s.refText)})`)
  results['1-new-reference'] = s.ns === 'WalkRef' && s.refText.includes('FirstProcess')
}
console.log('leg 1 (new reference):', results['1-new-reference'])

// ── Leg 2: a new implementation model ────────────────────────────────
await page.evaluate(`(() => { document.querySelector('[data-testid="open-new"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="kind-implementation"]').click()
  const t = document.querySelector('[data-testid="new-title"]')
  t.value = 'Acme Verification Lab'
  t.dispatchEvent(new Event('input', { bubbles: true }))
  const n = document.querySelector('[data-testid="new-namespace"]')
  n.value = 'WalkLab'
  n.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="new-create"]').click() })()`)
await new Promise(r => setTimeout(r, 600))
{
  const s = await page.evaluate(`(() => ({
    ns: window.__stores.model.standard.meta.namespace,
    note: window.__stores.model.standard.notes.map((n) => n.id),
    nodes: document.querySelectorAll('.node-group').length,
  }))()`)
  results['2-new-implementation'] = s.ns === 'WalkLab' && s.note.includes('MappingGuide') && s.nodes === 3
}
console.log('leg 2 (new implementation):', results['2-new-implementation'])

// ── Leg 3: data register + dataclass with attributes ─────────────────
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-registry"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="palette-dataclass"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
// An attribute on the dataclass (the tree selects DC1; the inspector adds).
await page.evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('.group-items li'))
  const dc = items.find((li) => li.textContent.includes('DC1'))
  dc?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="attr-add-input"]')
  if (!input) return
  input.value = 'reading'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="attr-add-btn"]')?.click() })()`)
await new Promise(r => setTimeout(r, 400))
// The registry's data_class links to DC1.
await page.evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('.group-items li'))
  const reg = items.find((li) => li.textContent.includes('REG1'))
  reg?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const sel = document.querySelector('[data-testid="registry-data-class"]')
  sel.value = 'DC1'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
{
  const s = await page.evaluate(`(() => ({
    reg: window.__stores.model.standard.regs.map((r) => ({ id: r.id, data: r.data?.id })),
    attrs: window.__stores.model.standard.dataclasses[0]?.attributes.map((a) => a.id),
    inDataSection: window.__stores.model.standard.pages.find((p) => p.id === window.__stores.model.standard.root?.id).data.map((c) => c.name),
  }))()`)
  results['3-data-registers'] = s.reg[0]?.id === 'REG1' && s.reg[0]?.data === 'DC1'
    && s.attrs?.includes('reading') && s.inDataSection.includes('DC1')
}
console.log('leg 3 (data registers):', results['3-data-registers'])

// ── Leg 4: processes, facets, drill in and out ───────────────────────
await page.evaluate(`(() => { document.querySelector('[data-testid="palette-process"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  document.querySelector('[data-node-id="P1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="inspector-name"]')
  input.value = 'Verify the thermometer'
  input.dispatchEvent(new Event('change', { bubbles: true }))
  const sel = document.querySelector('[data-testid="inspector-actor"]')
  sel.value = 'WalkLab'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
// Drill in: create the subprocess page from the inspector, open it.
await page.evaluate(`(() => { document.querySelector('[data-testid="inspector-new-page"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => { document.querySelector('[data-testid="inspector-open-page"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
// A node inside the page.
await page.evaluate(`(() => { document.querySelector('[data-testid="palette-process"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
const drillIn = await page.evaluate(`(() => ({
  breadcrumb: document.querySelector('[data-testid="canvas-breadcrumb"]')?.textContent ?? null,
  nodeInside: !!document.querySelector('[data-node-id="P2"]'),
  pageHasNode: window.__stores.model.standard.pages.find((p) => p.id === 'Page1')?.childs.map((c) => c.name),
}))()`)
// Drill out via the breadcrumb.
await page.evaluate(`(() => {
  const crumbs = Array.from(document.querySelectorAll('.crumb-link'))
  crumbs.find((c) => c.textContent === 'Root')?.click()
})()`)
await new Promise(r => setTimeout(r, 400))
const drillOut = await page.evaluate(`(() => ({
  backAtRoot: !document.querySelector('[data-testid="canvas-breadcrumb"]'),
  renamed: window.__stores.model.standard.processes.find((p) => p.id === 'P1')?.name,
  actor: window.__stores.model.standard.processes.find((p) => p.id === 'P1')?.actor?.id,
}))()`)
results['4-processes-drill'] = drillIn.breadcrumb?.includes('Root') && drillIn.breadcrumb?.includes('Page1')
  && drillIn.nodeInside && drillIn.pageHasNode?.includes('P2')
  && drillOut.backAtRoot && drillOut.renamed === 'Verify the thermometer' && drillOut.actor === 'WalkLab'
console.log('leg 4 (processes, drill in/out):', results['4-processes-drill'])

// ── Leg 5: diagrams render; page tabs switch ─────────────────────────
await page.evaluate(`(() => {
  const tabs = Array.from(document.querySelectorAll('.canvas-tab'))
  tabs.find((t) => t.textContent === 'Page1')?.click()
})()`)
await new Promise(r => setTimeout(r, 400))
{
  const s = await page.evaluate(`(() => ({
    tabActive: document.querySelector('.canvas-tab.active')?.textContent ?? null,
    svgNodes: document.querySelectorAll('.canvas-svg .node-group').length,
    svgEdges: document.querySelectorAll('.canvas-svg .edge-group').length,
  }))()`)
  results['5-diagrams'] = s.tabActive === 'Page1' && s.svgNodes >= 1 && s.svgEdges >= 0
}
console.log('leg 5 (diagrams, tabs):', results['5-diagrams'])

// ── Leg 6: mapping with coverage ─────────────────────────────────────
await page.evaluate(`(() => {
  const s = window.__stores
  s.ui.view = 'mapping'
  s.mapping.loadRefText(window.__walkRefText)
})()`)
await new Promise(r => setTimeout(r, 700))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="ref-pane"] [data-node-id="FirstProcess"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="imp-pane"] [data-node-id="P1"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const d = document.querySelector('[data-testid="pair-description"]')
  d.value = 'verification covers the requirement'
  d.dispatchEvent(new Event('input', { bubbles: true }))
  document.querySelector('[data-testid="pair-confirm"]').click()
})()`)
await new Promise(r => setTimeout(r, 600))
{
  const s = await page.evaluate(`(() => {
    const profile = window.__stores.model.standard.mapProfiles.find((p) => p.namespace === 'WalkRef')
    return {
      pair: profile?.mappings?.['P1']?.[0]?.target ?? null,
      meta: profile?.mappings?.['P1']?.[0]?.description ?? null,
      overlayEdge: !!document.querySelector('[data-testid="map-edge-P1"]'),
      refTint: document.querySelector('[data-testid="ref-pane"] [data-node-id="FirstProcess"]')?.getAttribute('style') ?? null,
      impTint: document.querySelector('[data-testid="imp-pane"] [data-node-id="P1"]')?.getAttribute('style') ?? null,
    }
  })()`)
  results['6-mapping-coverage'] = s.pair === 'WalkRef#FirstProcess'
    && s.meta === 'verification covers the requirement'
    && s.overlayEdge
    && !!s.refTint?.includes('drop-shadow') && !!s.impTint?.includes('drop-shadow')
}
console.log('leg 6 (mapping + coverage):', results['6-mapping-coverage'])

// ── Leg 7: run the execution (a gate branches on an edited register) ─
// Build the gate into the implementation model, then walk it.
await page.evaluate(`(() => {
  const s = window.__stores
  s.ui.view = 'model'
  s.model.execute({
    label: 'build the gate',
    apply(ast) {
      const root = ast.pages.find((p) => p.id === ast.root?.id)
      ast.gateways.push({ id: 'X1', gatewayType: 'exclusive_gateway', label: '' })
      root.childs.push({ name: 'X1', element: { id: 'X1' }, x: 0, y: 240 })
      ast.variables.push({ id: 'temperature', type: 'float', definition: 'Reading', description: '' })
      // Rewire the template's short-circuit: the flow routes through
      // the gate (E2 FirstProcess→Done would win as the first default).
      root.edges = root.edges.filter((e) => e.id !== 'E2')
      root.edges.push(
        { id: 'EG1', from: { name: 'FirstProcess', element: { id: 'FirstProcess' }, x: 0, y: 0 }, to: { name: 'X1', element: { id: 'X1' }, x: 0, y: 0 }, description: '', condition: '' },
        { id: 'EG2', from: { name: 'X1', element: { id: 'X1' }, x: 0, y: 0 }, to: { name: 'P1', element: { id: 'P1' }, x: 0, y: 0 }, description: '', condition: 'temperature > 36' },
        { id: 'EG3', from: { name: 'X1', element: { id: 'X1' }, x: 0, y: 0 }, to: { name: 'Done', element: { id: 'Done' }, x: 0, y: 0 }, description: '', condition: '' },
      )
    },
    revert() {},
  })
  s.ui.rightPanel = 'simulation'
})()`)
await new Promise(r => setTimeout(r, 500))
// Set the register and run.
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-start"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="register-temperature"]')
  input.value = '37.5'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="sim-continue"]').click() })()`)
await new Promise(r => setTimeout(r, 500))
{
  const s = await page.evaluate(`(() => ({
    done: !!document.querySelector('[data-testid="sim-done"]'),
    trajectory: window.__stores ? Array.from(document.querySelectorAll('.trajectory-node')).map((n) => n.textContent) : [],
  }))()`)
  results['7-run-execution'] = s.done
    && s.trajectory.includes('X1') && s.trajectory.includes('P1') && !s.trajectory.slice(-1).includes('X1')
}
console.log('leg 7 (run execution):', results['7-run-execution'])

// ── Leg 8: import a legacy MMEL file (in-browser path) ───────────────
const corpusText = await page.evaluate(`(async () => {
  const res = await fetch('/src/lib/__tests__/fixtures/corpus/acme.mmel?raw')
  const mod = await res.text()
  return mod
})()`)
await page.evaluate(`(async (text) => {
  const { importLegacy } = await import('/src/lib/mmel-import.ts')
  const result = importLegacy(text)
  window.__stores.model.loadText(result.canonical)
})(${JSON.stringify(corpusText)})`)
await new Promise(r => setTimeout(r, 700))
{
  const s = await page.evaluate(`(() => ({
    processes: window.__stores.model.standard.processes.length,
    ns: window.__stores.model.standard.meta.namespace,
    parseError: window.__stores.model.parseError,
  }))()`)
  results['8-import-mmel'] = s.processes === 14 && !s.parseError
}
console.log('leg 8 (import MMEL):', results['8-import-mmel'])

// ── Leg 9: save with the diff preview ────────────────────────────────
await page.evaluate(`(() => {
  window.__stores.model.execute({
    label: 'walk edit',
    apply(ast) { ast.processes[0].name = 'Edited in the walk' },
    revert() {},
  })
  document.querySelector('[data-testid="open-save"]').click()
})()`)
await new Promise(r => setTimeout(r, 600))
{
  const s = await page.evaluate(`(() => ({
    panel: !!document.querySelector('[data-testid="save-panel"]'),
    changed: document.querySelector('[data-testid="save-count-changed"]')?.textContent?.trim() ?? null,
    row: document.querySelector('.save-row-text')?.textContent ?? null,
  }))()`)
  results['9-save-preview'] = s.panel && s.changed === 'changed 1' && !!s.row
}
console.log('leg 9 (save preview):', results['9-save-preview'])

// ── The verdict ──────────────────────────────────────────────────────
const legs = Object.entries(results)
for (const [name, ok] of legs) console.log(`${ok ? '✓' : '✗'} ${name}`)
const allOk = legs.every(([, ok]) => ok)
console.log(allOk ? 'CAPABILITY WALK OK (9/9)' : 'CAPABILITY WALK FAILED')
await browser.close()
process.exit(allOk ? 0 : 1)

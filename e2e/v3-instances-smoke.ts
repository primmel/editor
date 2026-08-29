import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 instance-plane leg (TODO.editor wave 03, window 2) — the
// instance + artifact surfaces on the live app: the tree sections, the
// inspectors (the chain links + the QuantityValue maps; the content
// contract with its produced_when), an edit through the command path,
// and the in-tree creates.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `subject LC500 {
}

instance smp-001 {
  of LC500
  level sample
  model mod-2t
  definition_versions { LC500 : "2021" }
  has {
    attributes { serial_number : "ABC-123" net_weight : 2.2 kg }
    test_context { d_min : 0 kg }
  }
}

artifact_definition evidence_file {
  name "Evidence file"
  content_contract {
    fields {
      speed : speed "The measured speed"
    }
  }
  produced_when per_measurement
}

artifact_instance ai-1 {
  of evidence_file
  produced_at "2026-08-29T10:00:00Z"
  by smp-001
  content {
    speed : 87.5 km/h
  }
  links { run-1 }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-INSTANCES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the three sections.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  instances: window.__stores.model.standard.instances.length,
  defs: window.__stores.model.standard.artifactDefinitions.length,
  artInst: window.__stores.model.standard.artifactInstances.length,
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Instances') || g.startsWith('Artifact')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.instances !== 1 || state.defs !== 1 || state.artInst !== 1
  || !state.groups.includes('Instances (1) +') || !state.groups.includes('Artifact Definitions (1) +') || !state.groups.includes('Artifact Instances (1) +'))
  await fail('the tree sections did not render')

// 2. The instance inspector opens with the chain + the value maps.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'smp-001')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="instance-inspector"]'),
  of: document.querySelector('[data-testid="inst-of"]')?.value ?? null,
  level: document.querySelector('[data-testid="inst-level"]')?.value ?? null,
  model: document.querySelector('[data-testid="inst-model"]')?.value ?? null,
  version: document.querySelector('[data-testid="inst-versions-value-LC500"]')?.value ?? null,
  netWeight: document.querySelector('[data-testid="inst-attrs-value-net_weight"]')?.value ?? null,
  netWeightUnit: document.querySelector('[data-testid="inst-attrs-unit-net_weight"]')?.value ?? null,
}))()`)
console.log('instance inspector:', JSON.stringify(state))
if (!state.inspector || state.of !== 'LC500' || state.level !== 'sample' || state.model !== 'mod-2t'
  || state.version !== '2021' || state.netWeight !== '2.2' || state.netWeightUnit !== 'kg')
  await fail('the instance inspector did not open with the chain')

// 3. An edit to a value map lands through the command path.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="inst-attrs-value-net_weight"]')
  el.value = '2.4'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  value: window.__stores.model.standard.instances[0]?.has.attributes['net_weight']?.value,
  serialized: window.__stores.model.serialize().includes('net_weight : 2.4 kg'),
}))()`)
if (state.value !== 2.4 || !state.serialized) await fail('the value-map edit did not land')

// 4. The artifact definition inspector opens with the contract.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'evidence_file')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="artifact-definition-inspector"]'),
  name: document.querySelector('[data-testid="adef-name"]')?.value ?? null,
  fieldType: document.querySelector('[data-testid="adef-field-type-speed"]')?.value ?? null,
  producedKind: document.querySelector('[data-testid="adef-produced-kind"]')?.value ?? null,
}))()`)
console.log('definition inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Evidence file' || state.fieldType !== 'speed' || state.producedKind !== 'per_measurement')
  await fail('the artifact definition inspector did not open with the contract')

// 5. The artifact instance inspector opens with the content.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'ai-1')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="artifact-instance-inspector"]'),
  of: document.querySelector('[data-testid="ainst-of"]')?.value ?? null,
  speed: document.querySelector('[data-testid="ainst-content-value-speed"]')?.value ?? null,
}))()`)
console.log('instance inspector:', JSON.stringify(state))
if (!state.inspector || state.of !== 'evidence_file' || state.speed !== '87.5')
  await fail('the artifact instance inspector did not open with the content')

// 6. The in-tree creates mint one of each.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-instance"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-artifactDefinition"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-artifactInstance"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  instances: window.__stores.model.standard.instances.map((i) => i.id),
  defs: window.__stores.model.standard.artifactDefinitions.map((a) => a.id),
  artInst: window.__stores.model.standard.artifactInstances.map((a) => a.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="artifact-instance-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.instances.includes('Inst1') || !state.defs.includes('ArtDef1') || !state.artInst.includes('ArtInst1')
  || state.selection?.id !== 'ArtInst1' || !state.inspector)
  await fail('the in-tree creates did not mint + select')

console.log('V3-INSTANCES OK')
await browser.close()
process.exit(0)
